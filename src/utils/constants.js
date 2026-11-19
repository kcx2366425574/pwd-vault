/**
 * 全局常量、错误码与统一错误对象。
 *
 * 安全约定：本文件不持有任何密钥、明文或凭证；仅存放公开的配置项与错误码。
 */

/** 密码库数据结构版本 */
export const VAULT_VERSION = 1

/** 校验挑战串（固定公开字符串，非敏感） */
export const CHECK_CHALLENGE = 'PV_CHECK_V1'

/** 密钥派生参数（集中管理，真机调参只改此处） */
export const KDF = {
  ALGORITHM: 'PBKDF2-HMAC-SHA256',
  ITERATIONS: 120000,
  /** PBKDF2 keySize 以 4 字节字为单位：8 => 32 字节 */
  KEY_SIZE_WORDS: 8,
  /** 32 字节派生密钥 */
  KEY_BYTES: 32,
  /** 盐 16 字节 */
  SALT_BYTES: 16,
  /** CBC 初始化向量 16 字节 */
  IV_BYTES: 16,
  /** 允许的最小迭代次数，防止被篡改为弱参数 */
  MIN_ITERATIONS: 10000,
  /** 允许的最大迭代次数，防止 DoS */
  MAX_ITERATIONS: 1000000
}

/** 密文/校验块前缀 */
export const PREFIX = {
  CHECK: 'PV1',
  RECORD: 'E1',
  BACKUP: 'PVBAK1'
}

/** 本地存储键（明文禁止写入） */
export const STORAGE_KEYS = {
  VAULT: 'pv.vault',
  SETTINGS: 'pv.settings'
}

/** 统一错误码：日志只允许出现这些 code */
export const ERROR_CODES = {
  CRYPTO_AUTH: 'E_CRYPTO_AUTH',
  CRYPTO_FORMAT: 'E_CRYPTO_FORMAT',
  CRYPTO_PARAMS: 'E_CRYPTO_PARAMS',
  LOCKED: 'E_LOCKED',
  BACKOFF: 'E_BACKOFF',
  SYNC_CONFLICT: 'E_SYNC_CONFLICT',
  STORAGE_WRITE: 'E_STORAGE_WRITE',
  CSPRNG_UNAVAILABLE: 'E_CSPRNG_UNAVAILABLE',
  VALIDATION: 'E_VALIDATION',
  BIOMETRIC: 'E_BIOMETRIC',
  BACKUP_FORMAT: 'E_BACKUP_FORMAT',
  CLIPBOARD: 'E_CLIPBOARD',
  UNKNOWN: 'E_UNKNOWN'
}

/** 全局事件总线事件名 */
export const EVENTS = {
  VAULT_CHANGED: 'vault:changed',
  AUTH_LOCKED: 'auth:locked',
  AUTH_UNLOCKED: 'auth:unlocked',
  SYNC_STATUS: 'sync:status',
  CLIPBOARD_CLEAR: 'clipboard:clear',
  SETTINGS_CHANGED: 'settings:changed'
}

/** 剪贴板自动清空（毫秒） */
export const CLIPBOARD_TTL_MS = 30000
export const CLIPBOARD_TTL_MIN_MS = 30000
export const CLIPBOARD_TTL_MAX_MS = 60000

/** 自动锁定：默认 1 分钟，可选 30s / 1m / 3m / 5m */
export const DEFAULT_LOCK_MS = 60000
export const LOCK_OPTIONS_MS = [30000, 60000, 180000, 300000]

/**
 * 认证失败退避阶梯：第 1/2/3+ 次失败分别等待 30s / 60s / 300s。
 * 从第一次失败即开始退避，保证「错误密码必触发退避」可被验证。
 */
export const BACKOFF_STEPS_MS = [30000, 60000, 300000]
export const MAX_FAIL_ATTEMPTS = 5

/** 主题与语言 */
export const THEME = { LIGHT: 'light', DARK: 'dark', AUTO: 'auto' }
export const LANGUAGES = { ZH_CN: 'zh-CN', EN_US: 'en-US' }

/** 生成器默认配置 */
export const GENERATOR_DEFAULTS = {
  LENGTH: 16,
  MIN_LENGTH: 8,
  MAX_LENGTH: 64,
  UPPER: true,
  LOWER: true,
  DIGITS: true,
  SYMBOLS: true,
  EXCLUDE_AMBIGUOUS: true
}

/** 生成器字符集（排除易混淆字符 0/O/1/l/I/|） */
export const CHAR_SETS = {
  LOWER: 'abcdefghijklmnopqrstuvwxyz',
  UPPER: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  DIGITS: '0123456789',
  DIGITS_SAFE: '23456789',
  SYMBOLS: '!@#$%^&*()-_=+[]{};:,.?',
  AMBIGUOUS: '0O1lI|'
}

/** 敏感字段清单：这些字段落盘前必须加密为 E1... 串 */
export const SENSITIVE_ENTRY_FIELDS = ['site', 'account', 'password', 'url', 'note']
export const SENSITIVE_META_FIELDS = ['name']

/** 内置分类（名称首次初始化时加密落盘） */
export const BUILTIN_CATEGORIES = [
  { key: 'social', name: '社交', color: '#4C8BF5' },
  { key: 'mail', name: '邮箱', color: '#22A06B' },
  { key: 'finance', name: '金融', color: '#E6A23C' },
  { key: 'work', name: '工作', color: '#8E6CE4' },
  { key: 'other', name: '其他', color: '#909399' }
]

/** 默认设置项（全部非敏感） */
export const DEFAULT_SETTINGS = {
  autoLockMs: DEFAULT_LOCK_MS,
  clipboardTtlMs: CLIPBOARD_TTL_MS,
  theme: THEME.AUTO,
  language: LANGUAGES.ZH_CN,
  secureScreen: true,
  biometricEnabled: false,
  autoSync: false
}

/** 统一的业务错误对象 {code, message} */
export class VaultError extends Error {
  /**
   * @param {string} code 错误码，取值见 ERROR_CODES
   * @param {string} [message] 面向用户的中文提示
   * @param {Object} [detail] 附加结构化信息（如 retryAfter），禁止包含明文
   */
  constructor(code, message, detail) {
    super(message || code)
    this.name = 'VaultError'
    this.code = code
    this.detail = detail || null
    if (typeof Object.setPrototypeOf === 'function') {
      Object.setPrototypeOf(this, VaultError.prototype)
    }
  }
}

/**
 * 创建统一错误对象。
 * @param {string} code 错误码
 * @param {string} [message] 提示文案
 * @param {Object} [detail] 附加信息（禁止明文）
 * @returns {VaultError}
 */
export function createError(code, message, detail) {
  return new VaultError(code, message, detail)
}

/**
 * 把任意异常规整为统一错误对象，避免把底层异常信息（可能含明文）外泄。
 * @param {*} err 原始异常
 * @returns {VaultError}
 */
export function normalizeError(err) {
  if (err instanceof VaultError) return err
  if (err && typeof err.code === 'string' && /^E_[A-Z0-9_]+$/.test(err.code)) {
    return new VaultError(err.code, '操作失败')
  }
  return new VaultError(ERROR_CODES.UNKNOWN, '操作失败，请稍后重试')
}
