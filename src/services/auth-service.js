/**
 * 认证服务：主密码设置/解锁/改密/锁定、失败退避、生物识别降级入口。
 *
 * 会话密钥由 SessionGuard 统一托管；明文库由 VaultService 在内存托管。
 * 本文件只依赖下层适配层，不依赖 Vuex，避免循环引用。
 */
import {
  KDF, EVENTS, ERROR_CODES, BACKOFF_STEPS_MS, createError, normalizeError
} from '../utils/constants.js'
import csprng from '../utils/csprng.js'
import cryptoAdapter from '../utils/crypto.js'
import sessionGuard from '../utils/session-guard.js'
import storage from '../utils/storage.js'
import validator from '../utils/validator.js'
import lockManager from '../utils/lock-manager.js'
import eventBus from '../utils/event-bus.js'
import logger from '../utils/logger.js'
import vaultService from './vault-service.js'

/** 连续失败次数 */
let failCount = 0
/** 退避截止时间戳（毫秒），0 表示不在退避中 */
let lockedUntil = 0

/** 锁定事件：清空 VaultService 中的内存明文 */
eventBus.on(EVENTS.AUTH_LOCKED, function () {
  vaultService.clearMemory()
})

/**
 * 读取并校验迭代次数，异常时回退默认值。
 * @param {Object} vault VaultDTO
 * @returns {number}
 */
function getIterations(vault) {
  const kdf = (vault && vault.kdf) || {}
  const iter = Number(kdf.iter)
  if (!Number.isInteger(iter) || iter < KDF.MIN_ITERATIONS || iter > KDF.MAX_ITERATIONS) {
    return KDF.ITERATIONS
  }
  return iter
}

/** 认证失败：递增计数并阶梯退避 */
function onAuthFailure() {
  failCount += 1
  const stepIndex = Math.min(failCount - 1, BACKOFF_STEPS_MS.length - 1)
  lockedUntil = Date.now() + BACKOFF_STEPS_MS[stepIndex]
  logger.error(ERROR_CODES.CRYPTO_AUTH, 'AUTH')
}

/** 认证成功：清空失败计数与退避 */
function resetFailures() {
  failCount = 0
  lockedUntil = 0
}

/**
 * 获取退避状态。
 * @returns {{inBackoff: boolean, retryAfter: number, failCount: number}}
 */
function getBackoffStatus() {
  const now = Date.now()
  if (lockedUntil > now) {
    return {
      inBackoff: true,
      retryAfter: Math.ceil((lockedUntil - now) / 1000),
      failCount: failCount
    }
  }
  return { inBackoff: false, retryAfter: 0, failCount: failCount }
}

const authService = {
  /**
   * 密码库是否已初始化。
   * @returns {boolean}
   */
  hasVault: function hasVault() {
    return storage.exists()
  },

  /**
   * 首次设置主密码：自检 CSPRNG -> 创建校验块 -> 派生会话 -> 初始化空库。
   * @param {string} pwd 主密码
   * @returns {boolean}
   */
  setupMasterPassword: function setupMasterPassword(pwd) {
    if (!csprng.selfCheck()) {
      throw createError(ERROR_CODES.CSPRNG_UNAVAILABLE, '当前设备不支持安全随机数，已拒绝设置')
    }
    const validation = validator.validateMasterPassword(pwd)
    if (!validation.valid) {
      throw createError(ERROR_CODES.VALIDATION, validation.errors[0])
    }
    if (storage.exists()) {
      throw createError(ERROR_CODES.VALIDATION, '密码库已存在，请勿重复设置')
    }

    const check = cryptoAdapter.createCheckBlock(pwd, KDF.ITERATIONS)
    const parsed = cryptoAdapter.parseCheckBlock(check)
    const masterKey = cryptoAdapter.deriveMasterKey(pwd, parsed.saltB64, KDF.ITERATIONS)

    try {
      sessionGuard.unlock(masterKey)
      vaultService.initialize({ check: check, iter: KDF.ITERATIONS, salt: parsed.saltB64 })
    } catch (e) {
      sessionGuard.lock()
      storage.clear()
      throw normalizeError(e)
    }

    resetFailures()
    eventBus.emit(EVENTS.AUTH_UNLOCKED, { via: 'setup' })
    return true
  },

  /**
   * 主密码解锁：退避检查 -> 校验块验证 -> 会话解锁 -> 装载明文到内存。
   * @param {string} pwd 主密码
   * @returns {boolean}
   */
  unlock: function unlock(pwd) {
    const status = getBackoffStatus()
    if (status.inBackoff) {
      throw createError(ERROR_CODES.BACKOFF, '尝试过于频繁，请稍后再试', { retryAfter: status.retryAfter })
    }
    const vault = storage.readVault()
    if (!vault || !vault.check) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '密码库未初始化')
    }

    let masterKey = null
    try {
      masterKey = cryptoAdapter.verifyAndDerive(pwd, vault.check, getIterations(vault))
    } catch (e) {
      if (masterKey) cryptoAdapter.wipe(masterKey)
      onAuthFailure()
      throw e
    }

    try {
      sessionGuard.unlock(masterKey)
      vaultService.load()
    } catch (e) {
      sessionGuard.lock()
      vaultService.clearMemory()
      throw normalizeError(e)
    }

    resetFailures()
    eventBus.emit(EVENTS.AUTH_UNLOCKED, { via: 'password' })
    return true
  },

  /**
   * 生物识别解锁入口。
   *
   * 当前实现为约定的降级分支：任何情况下都不绕过主密码，返回 false 让页面回退到
   * 主密码输入。T04 接入 utils/biometric.js 后，在本方法内先完成原生认证，再解封
   * 主密钥并复用下方解锁流程；底层加密方案不变。
   *
   * @returns {boolean} 是否成功解锁
   */
  unlockByBiometric: function unlockByBiometric() {
    const status = getBackoffStatus()
    if (status.inBackoff) {
      throw createError(ERROR_CODES.BACKOFF, '尝试过于频繁，请稍后再试', { retryAfter: status.retryAfter })
    }
    logger.debug('BIOMETRIC', 0)
    return false
  },

  /**
   * 修改主密码：验证旧密码 -> 内存备份旧密文 -> 全量重加密 -> 原子写回 -> 失败回滚。
   * @param {string} oldPwd 旧主密码
   * @param {string} newPwd 新主密码
   * @returns {boolean}
   */
  changeMasterPassword: function changeMasterPassword(oldPwd, newPwd) {
    if (!sessionGuard.isUnlocked()) {
      throw createError(ERROR_CODES.LOCKED, '请先解锁密码库')
    }
    const validation = validator.validateMasterPassword(newPwd)
    if (!validation.valid) {
      throw createError(ERROR_CODES.VALIDATION, validation.errors[0])
    }

    const oldVault = storage.readVault()
    if (!oldVault || !oldVault.check) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '密码库未初始化')
    }

    const oldMasterKey = cryptoAdapter.verifyAndDerive(oldPwd, oldVault.check, getIterations(oldVault))
    const oldSubKeys = cryptoAdapter.deriveSubKeys(oldMasterKey)
    storage.backupOld(oldVault)

    try {
      const newCheck = cryptoAdapter.createCheckBlock(newPwd, KDF.ITERATIONS)
      const newSalt = cryptoAdapter.parseCheckBlock(newCheck).saltB64
      const newMasterKey = cryptoAdapter.deriveMasterKey(newPwd, newSalt, KDF.ITERATIONS)
      const newSubKeys = cryptoAdapter.deriveSubKeys(newMasterKey)

      const newVault = vaultService.reEncryptVault(
        oldVault, oldSubKeys, newSubKeys, newCheck, KDF.ITERATIONS, newSalt
      )
      storage.writeVault(newVault)

      // 顺序关键：先切换会话密钥，再用新密钥解密内存集合
      sessionGuard.unlock(newMasterKey)
      vaultService.applyDTO(newVault)

      cryptoAdapter.wipe(oldMasterKey)
      cryptoAdapter.wipeSubKeys(oldSubKeys)
      storage.discardBackup()
      resetFailures()
      logger.debug('AUTH', 1)
      return true
    } catch (e) {
      const backup = storage.restoreBackup()
      if (backup) {
        try {
          vaultService.applyDTO(backup)
        } catch (inner) {
          logger.error(ERROR_CODES.CRYPTO_AUTH, 'AUTH')
        }
      }
      cryptoAdapter.wipe(oldMasterKey)
      cryptoAdapter.wipeSubKeys(oldSubKeys)
      throw normalizeError(e)
    }
  },

  /**
   * 锁定：wipe 会话 + 清空剪贴板 + 清空内存明文 + 广播事件。
   */
  lock: function lock() {
    sessionGuard.lock()
    vaultService.clearMemory()
    lockManager.lockNow('manual')
  },

  /**
   * 是否已解锁。
   * @returns {boolean}
   */
  isUnlocked: function isUnlocked() {
    return sessionGuard.isUnlocked()
  },

  /**
   * 获取退避状态（供 UI 显示倒计时）。
   * @returns {{inBackoff: boolean, retryAfter: number, failCount: number}}
   */
  getBackoffStatus: getBackoffStatus
}

export default authService
