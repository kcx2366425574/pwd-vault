/**
 * 安全日志：只输出错误码与白名单模块标签，绝不输出明文、密码、密钥或密文。
 *
 * 所有参数在进入 console 前都经过白名单过滤；任何非白名单字符串统一替换为 [masked]。
 * 生产构建同样保留错误码日志，便于真机排查而不泄露敏感信息。
 */
import { ERROR_CODES } from './constants.js'

/** 允许输出的标签（模块代号），全部为大写 ASCII，不含用户输入 */
const ALLOWED_TAGS = [
  'BOOT', 'KDF', 'AES', 'HMAC', 'STORE', 'LOCK', 'AUTH', 'SYNC',
  'BACKUP', 'AUTOFILL', 'BIOMETRIC', 'CSPRNG', 'VALIDATE',
  'SCHEDULE', 'CLIPBOARD', 'ENTRY', 'CATEGORY', 'TAG', 'SETTINGS',
  'EVENT_ON', 'EVENT_OFF', 'EVENT_ONCE', 'EVENT_EMIT'
]

const allowedCodes = {}
Object.keys(ERROR_CODES).forEach(function (key) {
  allowedCodes[ERROR_CODES[key]] = true
})

const allowedTags = {}
ALLOWED_TAGS.forEach(function (tag) {
  allowedTags[tag] = true
})

/**
 * 白名单过滤：仅允许已知错误码/标签与有限数字通过。
 * @param {*} value 原始值
 * @returns {string|number} 可安全输出的值
 */
function sanitize(value) {
  if (typeof value === 'number' && isFinite(value)) return value
  if (typeof value !== 'string') return '[masked]'
  if (allowedCodes[value] || allowedTags[value]) return value
  return '[masked]'
}

const PREFIX = '[PV]'

const logger = {
  /**
   * 记录错误（仅错误码）。
   * @param {string} code 错误码
   * @param {string} [tag] 模块标签
   */
  error: function error(code, tag) {
    try {
      console.error(PREFIX, sanitize(code), sanitize(tag || 'BOOT'))
    } catch (e) {
      // 日志设施自身异常必须静默，绝不能影响主流程
    }
  },

  /**
   * 记录警告（仅错误码）。
   * @param {string} code 错误码
   * @param {string} [tag] 模块标签
   */
  warn: function warn(code, tag) {
    try {
      console.warn(PREFIX, sanitize(code), sanitize(tag || 'BOOT'))
    } catch (e) {
      // ignore
    }
  },

  /**
   * 记录调试信息（仅错误码/标签/数字，禁止明文）。
   * @param {string} code 码值或标签
   * @param {number} [count] 计数
   */
  debug: function debug(code, count) {
    try {
      console.log(PREFIX, sanitize(code), sanitize(count === undefined ? 0 : count))
    } catch (e) {
      // ignore
    }
  }
}

export default logger
