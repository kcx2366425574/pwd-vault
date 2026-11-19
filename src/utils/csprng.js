/**
 * CSPRNG 安全随机适配层。
 *
 * 统一随机出口，禁用 Math.random()。优先使用 Web Crypto 的 crypto.getRandomValues，
 * App 端按条件编译使用 plus.crypto 兜底；两者均不可用时 selfCheck() 返回 false，
 * 上层必须拒绝进入主密码设置流程（绝不降级到不安全随机）。
 */
import { ERROR_CODES, KDF, createError } from './constants.js'
import logger from './logger.js'

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * 探测平台可用的密码学随机源。
 * @returns {Object|null} 具备 getRandomValues 的对象
 */
function resolveCryptoSource() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    return globalThis.crypto
  }
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
    return window.crypto
  }
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus.crypto && typeof plus.crypto.getRandomValues === 'function') {
      return plus.crypto
    }
  } catch (e) {
    logger.error(ERROR_CODES.CSPRNG_UNAVAILABLE, 'CSPRNG')
  }
  // #endif
  return null
}

/**
 * 字节数组转标准 base64（不依赖 CryptoJS，避免循环依赖）。
 * @param {Uint8Array} bytes 输入字节
 * @returns {string} 标准 base64（含 = 填充）
 */
function bytesToBase64(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += BASE64_ALPHABET.charAt(b0 >> 2)
    out += BASE64_ALPHABET.charAt(((b0 & 0x03) << 4) | (b1 >> 4))
    out += i + 1 < bytes.length ? BASE64_ALPHABET.charAt(((b1 & 0x0f) << 2) | (b2 >> 6)) : '='
    out += i + 2 < bytes.length ? BASE64_ALPHABET.charAt(b2 & 0x3f) : '='
  }
  return out
}

const csprng = {
  /**
   * 生成密码学安全随机字节。
   * @param {number} length 字节数（1..65536）
   * @returns {Uint8Array}
   */
  getRandomValues: function getRandomValues(length) {
    const len = Number(length)
    if (!Number.isInteger(len) || len <= 0 || len > 65536) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '随机长度参数非法')
    }
    const source = resolveCryptoSource()
    if (!source) {
      logger.error(ERROR_CODES.CSPRNG_UNAVAILABLE, 'CSPRNG')
      throw createError(ERROR_CODES.CSPRNG_UNAVAILABLE, '当前环境不支持安全随机数')
    }
    const out = new Uint8Array(len)
    source.getRandomValues(out)
    return out
  },

  /**
   * 生成 base64 编码的随机字节（用于盐、IV 等）。
   * @param {number} length 字节数
   * @returns {string}
   */
  randomB64: function randomB64(length) {
    return bytesToBase64(this.getRandomValues(length))
  },

  /**
   * 生成密码学安全的 UUID-like ID（v4 变体）。
   * 用于条目 ID、deviceId，非敏感，可明文存储。
   * @returns {string}
   */
  randomId: function randomId() {
    const bytes = this.getRandomValues(16)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    let hex = ''
    for (let i = 0; i < bytes.length; i++) {
      const part = bytes[i].toString(16)
      hex += part.length === 1 ? '0' + part : part
    }
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' + hex.slice(20)
  },

  /**
   * 生成指定字节数的随机密钥材料。
   * @param {number} [length] 默认 32 字节
   * @returns {Uint8Array}
   */
  randomKey: function randomKey(length) {
    return this.getRandomValues(length || KDF.KEY_BYTES)
  },

  /**
   * 启动自检：连续两次采样必须不同且不能全零。
   * @returns {boolean}
   */
  selfCheck: function selfCheck() {
    const source = resolveCryptoSource()
    if (!source) {
      logger.error(ERROR_CODES.CSPRNG_UNAVAILABLE, 'CSPRNG')
      return false
    }
    try {
      const first = new Uint8Array(32)
      const second = new Uint8Array(32)
      source.getRandomValues(first)
      source.getRandomValues(second)
      let different = false
      let nonZero = false
      for (let i = 0; i < first.length; i++) {
        if (first[i] !== second[i]) different = true
        if (first[i] !== 0) nonZero = true
      }
      if (!different || !nonZero) {
        logger.error(ERROR_CODES.CSPRNG_UNAVAILABLE, 'CSPRNG')
        return false
      }
      return true
    } catch (e) {
      logger.error(ERROR_CODES.CSPRNG_UNAVAILABLE, 'CSPRNG')
      return false
    }
  }
}

export default csprng
