/**
 * 会话守卫（对应类图的 SessionGuard）。
 *
 * 集中托管 masterKey 与 subKeys，锁定统一 wipe。
 * 独立成文件是为了打断 auth-service 与 vault-service 之间的循环依赖：
 * 两者都只依赖本模块，而不互相持有会话状态。
 */
import { KDF, ERROR_CODES, createError } from './constants.js'
import cryptoAdapter from './crypto.js'

class SessionGuard {
  /**
   * 构造空会话。
   */
  constructor() {
    this.masterKey = null
    this.subKeys = null
    this.unlockedAt = 0
  }

  /**
   * 用主密钥解锁：先清理旧会话，再派生子密钥。
   * @param {Uint8Array} masterKey 32 字节主密钥
   */
  unlock(masterKey) {
    if (!masterKey || masterKey.length !== KDF.KEY_BYTES) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '主密钥非法')
    }
    this.lock()
    this.masterKey = masterKey
    this.subKeys = cryptoAdapter.deriveSubKeys(masterKey)
    this.unlockedAt = Date.now()
  }

  /** 锁定：覆盖密钥字节并解除全部引用 */
  lock() {
    if (this.masterKey) cryptoAdapter.wipe(this.masterKey)
    if (this.subKeys) cryptoAdapter.wipeSubKeys(this.subKeys)
    this.masterKey = null
    this.subKeys = null
    this.unlockedAt = 0
  }

  /**
   * 获取子密钥（未解锁抛 E_LOCKED）。
   * @returns {{encKey: Uint8Array, macKey: Uint8Array}}
   */
  getSubKeys() {
    if (!this.isUnlocked()) throw createError(ERROR_CODES.LOCKED, '密码库已锁定')
    return this.subKeys
  }

  /**
   * 获取主密钥（未解锁返回 null）。
   * @returns {Uint8Array|null}
   */
  getMasterKey() {
    return this.masterKey
  }

  /**
   * 是否已解锁。
   * @returns {boolean}
   */
  isUnlocked() {
    return !!(this.masterKey && this.subKeys)
  }

  /**
   * 解锁时间戳（毫秒），未解锁为 0。
   * @returns {number}
   */
  getUnlockedAt() {
    return this.unlockedAt
  }
}

/** 全局唯一会话实例 */
export const sessionGuard = new SessionGuard()
export default sessionGuard
