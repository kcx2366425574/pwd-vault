/**
 * 密码库服务：整库密文的装载、解密到内存、原子写回、换密钥重加密。
 *
 * 敏感字段按 SENSITIVE_ENTRY_FIELDS 加密为 E1... 串；
 * id / 时间戳 / deviceId / version 保持明文，仅用于同步合并，不含可识别的账号信息。
 */
import {
  VAULT_VERSION, KDF, PREFIX, SENSITIVE_ENTRY_FIELDS, SENSITIVE_META_FIELDS,
  BUILTIN_CATEGORIES, EVENTS, ERROR_CODES, createError
} from '../utils/constants.js'
import csprng from '../utils/csprng.js'
import cryptoAdapter from '../utils/crypto.js'
import sessionGuard from '../utils/session-guard.js'
import storage from '../utils/storage.js'
import eventBus from '../utils/event-bus.js'
import logger from '../utils/logger.js'

/** 当前内存明文集合（仅进程内，不落盘、不打印） */
let entries = []
let categories = []
let tags = []

/** 当前整库密文 DTO（只含密文与非敏感元数据） */
let vaultDTO = null

/**
 * 解密单个字段；失败只记录错误码并返回空串，避免单字段损坏阻断整库。
 * @param {*} value 字段密文
 * @param {Object} subKeys 子密钥
 * @returns {string}
 */
function safeDecrypt(value, subKeys) {
  if (typeof value !== 'string') return value === null || value === undefined ? '' : String(value)
  if (value.indexOf(PREFIX.RECORD + '.') !== 0) return value
  try {
    return cryptoAdapter.decryptRecord(value, subKeys)
  } catch (e) {
    logger.error(ERROR_CODES.CRYPTO_AUTH, 'ENTRY')
    return ''
  }
}

/**
 * 解密条目敏感字段，保留所有非敏感字段原样。
 * @param {Object} encEntry 落盘条目
 * @param {Object} subKeys 子密钥
 * @returns {Object} 明文条目
 */
function decryptEntry(encEntry, subKeys) {
  const out = Object.assign({}, encEntry)
  for (let i = 0; i < SENSITIVE_ENTRY_FIELDS.length; i++) {
    const field = SENSITIVE_ENTRY_FIELDS[i]
    out[field] = safeDecrypt(encEntry[field], subKeys)
  }
  return out
}

/**
 * 加密条目敏感字段，非敏感字段保持明文。
 * @param {Object} plainEntry 明文条目
 * @param {Object} subKeys 子密钥
 * @returns {Object} 落盘条目
 */
function encryptEntry(plainEntry, subKeys) {
  const out = Object.assign({}, plainEntry)
  for (let i = 0; i < SENSITIVE_ENTRY_FIELDS.length; i++) {
    const field = SENSITIVE_ENTRY_FIELDS[i]
    const value = plainEntry[field] === null || plainEntry[field] === undefined ? '' : String(plainEntry[field])
    out[field] = cryptoAdapter.encryptRecord(value, subKeys)
  }
  return out
}

/**
 * 解密分类/标签的名称字段。
 * @param {Object} meta 落盘元数据
 * @param {Object} subKeys 子密钥
 * @returns {Object}
 */
function decryptMeta(meta, subKeys) {
  const out = Object.assign({}, meta)
  for (let i = 0; i < SENSITIVE_META_FIELDS.length; i++) {
    const field = SENSITIVE_META_FIELDS[i]
    out[field] = safeDecrypt(meta[field], subKeys)
  }
  return out
}

/**
 * 加密分类/标签的名称字段。
 * @param {Object} meta 明文元数据
 * @param {Object} subKeys 子密钥
 * @returns {Object}
 */
function encryptMeta(meta, subKeys) {
  const out = Object.assign({}, meta)
  for (let i = 0; i < SENSITIVE_META_FIELDS.length; i++) {
    const field = SENSITIVE_META_FIELDS[i]
    const value = meta[field] === null || meta[field] === undefined ? '' : String(meta[field])
    out[field] = cryptoAdapter.encryptRecord(value, subKeys)
  }
  return out
}

/** 由当前 DTO 解密填充内存集合 */
function decryptIntoMemory() {
  if (!vaultDTO) throw createError(ERROR_CODES.CRYPTO_PARAMS, '密码库尚未加载')
  const subKeys = sessionGuard.getSubKeys()
  const sourceEntries = Array.isArray(vaultDTO.entries) ? vaultDTO.entries : []
  const sourceCategories = Array.isArray(vaultDTO.categories) ? vaultDTO.categories : []
  const sourceTags = Array.isArray(vaultDTO.tags) ? vaultDTO.tags : []
  entries = sourceEntries.map(function (item) {
    return decryptEntry(item, subKeys)
  })
  categories = sourceCategories.map(function (item) {
    return decryptMeta(item, subKeys)
  })
  tags = sourceTags.map(function (item) {
    return decryptMeta(item, subKeys)
  })
}

const vaultService = {
  /**
   * 首次设置后初始化空库并落盘（含内置分类，名称加密）。
   * @param {{check: string, iter: number, salt: string}} params 校验块与 KDF 参数
   */
  initialize: function initialize(params) {
    const options = params || {}
    if (!options.check || !options.salt) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '初始化参数不完整')
    }
    const subKeys = sessionGuard.getSubKeys()
    const now = Date.now()
    const builtin = BUILTIN_CATEGORIES.map(function (item) {
      return {
        id: csprng.randomId(),
        name: cryptoAdapter.encryptRecord(item.name, subKeys),
        builtin: true,
        color: item.color,
        createdAt: now
      }
    })
    vaultDTO = {
      v: VAULT_VERSION,
      kdf: { iter: options.iter || KDF.ITERATIONS, salt: options.salt, saltB64: options.salt },
      check: options.check,
      entries: [],
      categories: builtin,
      tags: [],
      meta: { deviceId: csprng.randomId(), createdAt: now, updatedAt: now, lastSyncAt: 0 }
    }
    storage.writeVault(vaultDTO)
    decryptIntoMemory()
    eventBus.emit(EVENTS.VAULT_CHANGED, { reason: 'init', count: 0 })
  },

  /**
   * 从 Storage 读取整库并解密到内存。
   * @returns {Object[]} 明文条目数组
   */
  load: function load() {
    const dto = storage.readVault()
    if (!dto || !dto.check) throw createError(ERROR_CODES.CRYPTO_PARAMS, '密码库未初始化')
    vaultDTO = dto
    decryptIntoMemory()
    eventBus.emit(EVENTS.VAULT_CHANGED, { reason: 'load', count: entries.length })
    return entries
  },

  /**
   * 把当前内存明文集合加密后原子写回 Storage。
   */
  persist: function persist() {
    if (!sessionGuard.isUnlocked()) throw createError(ERROR_CODES.LOCKED, '密码库已锁定')
    if (!vaultDTO) throw createError(ERROR_CODES.CRYPTO_PARAMS, '密码库尚未加载')
    const subKeys = sessionGuard.getSubKeys()
    const next = Object.assign({}, vaultDTO, {
      v: VAULT_VERSION,
      entries: entries.map(function (item) {
        return encryptEntry(item, subKeys)
      }),
      categories: categories.map(function (item) {
        return encryptMeta(item, subKeys)
      }),
      tags: tags.map(function (item) {
        return encryptMeta(item, subKeys)
      }),
      meta: Object.assign({}, vaultDTO.meta || {}, { updatedAt: Date.now() })
    })
    storage.writeVault(next)
    vaultDTO = next
    eventBus.emit(EVENTS.VAULT_CHANGED, { reason: 'persist', count: entries.length })
  },

  /**
   * 返回内存明文条目副本。
   * @returns {Object[]}
   */
  decryptAll: function decryptAll() {
    return entries.slice()
  },

  /**
   * 按 id 获取内存明文条目。
   * @param {string} id 条目 ID
   * @returns {Object|null}
   */
  getEntry: function getEntry(id) {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].id === id) return entries[i]
    }
    return null
  },

  /** @returns {Object[]} 内存明文条目数组（服务层可直接修改后调用 persist） */
  getEntries: function getEntries() {
    return entries
  },

  /** @param {Object[]} list 新的明文条目集合 */
  setEntries: function setEntries(list) {
    entries = Array.isArray(list) ? list : []
  },

  /** @returns {Object[]} 内存明文分类数组 */
  getCategories: function getCategories() {
    return categories
  },

  /** @param {Object[]} list 新的明文分类集合 */
  setCategories: function setCategories(list) {
    categories = Array.isArray(list) ? list : []
  },

  /** @returns {Object[]} 内存明文标签数组 */
  getTags: function getTags() {
    return tags
  },

  /** @param {Object[]} list 新的明文标签集合 */
  setTags: function setTags(list) {
    tags = Array.isArray(list) ? list : []
  },

  /** @returns {Object} 设备元数据（非敏感） */
  getMeta: function getMeta() {
    return (vaultDTO && vaultDTO.meta) || { deviceId: '', createdAt: 0, updatedAt: 0, lastSyncAt: 0 }
  },

  /** @returns {Object|null} 当前密文 DTO */
  getVaultDTO: function getVaultDTO() {
    return vaultDTO
  },

  /**
   * 整库密文 JSON（供同步/备份使用，服务端拿不到密钥）。
   * @returns {string}
   */
  getVaultCipher: function getVaultCipher() {
    return vaultDTO ? JSON.stringify(vaultDTO) : ''
  },

  /**
   * 用一个 DTO 替换当前库并解密到内存（导入/同步/回滚后调用）。
   * @param {Object} dto 新的 VaultDTO
   */
  applyDTO: function applyDTO(dto) {
    if (!dto || typeof dto !== 'object') throw createError(ERROR_CODES.CRYPTO_FORMAT, '库数据格式错误')
    vaultDTO = dto
    decryptIntoMemory()
    eventBus.emit(EVENTS.VAULT_CHANGED, { reason: 'apply', count: entries.length })
  },

  /**
   * 用新密钥体系重加密整库（改密核心步骤，不写盘）。
   * @param {Object} baseVault 旧 DTO
   * @param {Object} oldSubKeys 旧子密钥
   * @param {Object} newSubKeys 新子密钥
   * @param {string} newCheck 新校验块
   * @param {number} newIter 新迭代次数
   * @param {string} newSalt 新盐（base64）
   * @returns {Object} 新 DTO
   */
  reEncryptVault: function reEncryptVault(baseVault, oldSubKeys, newSubKeys, newCheck, newIter, newSalt) {
    if (!baseVault || !oldSubKeys || !newSubKeys || !newCheck || !newSalt) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '重加密参数不完整')
    }
    const oldEntries = Array.isArray(baseVault.entries) ? baseVault.entries : []
    const oldCategories = Array.isArray(baseVault.categories) ? baseVault.categories : []
    const oldTags = Array.isArray(baseVault.tags) ? baseVault.tags : []
    return Object.assign({}, baseVault, {
      v: VAULT_VERSION,
      kdf: { iter: newIter, salt: newSalt, saltB64: newSalt },
      check: newCheck,
      entries: oldEntries.map(function (item) {
        return encryptEntry(decryptEntry(item, oldSubKeys), newSubKeys)
      }),
      categories: oldCategories.map(function (item) {
        return encryptMeta(decryptMeta(item, oldSubKeys), newSubKeys)
      }),
      tags: oldTags.map(function (item) {
        return encryptMeta(decryptMeta(item, oldSubKeys), newSubKeys)
      }),
      meta: Object.assign({}, baseVault.meta || {}, { updatedAt: Date.now() })
    })
  },

  /**
   * 锁定后清空内存明文（密文 DTO 保留以便退避校验使用）。
   */
  clearMemory: function clearMemory() {
    entries = []
    categories = []
    tags = []
  }
}

export default vaultService
