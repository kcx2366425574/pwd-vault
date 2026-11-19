/**
 * 存储适配层：整库单键原子读写 + 改密前的内存备份/回滚。
 *
 * 安全约定：写入 Storage 的 JSON 只允许包含密文（E1.../PV1...）与非敏感元数据；
 * 本文件绝不接收、打印或持久化明文与派生密钥。
 */
import { STORAGE_KEYS, ERROR_CODES, createError } from './constants.js'
import logger from './logger.js'

/** 改密/迁移前的旧密文快照，仅存在于内存 */
let memoryBackup = null

/**
 * 内存深拷贝（仅用于处理密文 DTO）。
 * @param {*} value 输入
 * @returns {*} 副本
 */
function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value))
}

const storage = {
  /**
   * 判断密码库是否已初始化。
   * @returns {boolean}
   */
  exists: function exists() {
    try {
      return !!uni.getStorageSync(STORAGE_KEYS.VAULT)
    } catch (e) {
      return false
    }
  },

  /**
   * 读取并解析整库 JSON。
   * @returns {Object|null} VaultDTO，读取失败返回 null
   */
  readVault: function readVault() {
    try {
      const raw = uni.getStorageSync(STORAGE_KEYS.VAULT)
      if (!raw) return null
      const dto = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!dto || typeof dto !== 'object') return null
      return dto
    } catch (e) {
      logger.error(ERROR_CODES.CRYPTO_FORMAT, 'STORE')
      return null
    }
  },

  /**
   * 单次原子写入完整快照。
   * @param {Object} vault VaultDTO（仅含密文与非敏感元数据）
   * @returns {boolean}
   */
  writeVault: function writeVault(vault) {
    try {
      uni.setStorageSync(STORAGE_KEYS.VAULT, JSON.stringify(vault))
      return true
    } catch (e) {
      logger.error(ERROR_CODES.STORAGE_WRITE, 'STORE')
      throw createError(ERROR_CODES.STORAGE_WRITE, '本地存储写入失败')
    }
  },

  /**
   * 改密/迁移前把旧密文备份到内存（不落盘）。
   * @param {Object} vault 旧 VaultDTO
   */
  backupOld: function backupOld(vault) {
    memoryBackup = clone(vault)
  },

  /**
   * 回滚：取出内存备份并写回 Storage。
   * @returns {Object|null} 备份的 VaultDTO
   */
  restoreBackup: function restoreBackup() {
    if (!memoryBackup) return null
    const backup = memoryBackup
    memoryBackup = null
    try {
      uni.setStorageSync(STORAGE_KEYS.VAULT, JSON.stringify(backup))
    } catch (e) {
      logger.error(ERROR_CODES.STORAGE_WRITE, 'STORE')
    }
    return backup
  },

  /**
   * 是否存在内存备份。
   * @returns {boolean}
   */
  hasBackup: function hasBackup() {
    return memoryBackup !== null
  },

  /** 丢弃内存备份（改密成功后调用） */
  discardBackup: function discardBackup() {
    memoryBackup = null
  },

  /** 清空密码库（仅用于自检或用户明确要求重置） */
  clear: function clear() {
    try {
      uni.removeStorageSync(STORAGE_KEYS.VAULT)
    } catch (e) {
      logger.error(ERROR_CODES.STORAGE_WRITE, 'STORE')
    }
    memoryBackup = null
  },

  /**
   * 读取设置项（非敏感）。
   * @returns {Object}
   */
  readSettings: function readSettings() {
    try {
      const raw = uni.getStorageSync(STORAGE_KEYS.SETTINGS)
      if (!raw) return {}
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (e) {
      return {}
    }
  },

  /**
   * 写入设置项（非敏感）。
   * @param {Object} settings 设置对象
   * @returns {boolean}
   */
  writeSettings: function writeSettings(settings) {
    try {
      uni.setStorageSync(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
      return true
    } catch (e) {
      logger.error(ERROR_CODES.STORAGE_WRITE, 'SETTINGS')
      return false
    }
  }
}

export default storage
