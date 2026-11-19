/**
 * 强密码生成服务。
 *
 * 安全纪律：唯一随机源为 CsprngAdapter（密码学安全），严禁 Math.random()；
 * 生成结果不写日志、不落盘，仅返回给调用方。
 */
import { GENERATOR_DEFAULTS, CHAR_SETS, ERROR_CODES, createError } from '../utils/constants.js'
import csprng from '../utils/csprng.js'

/** 用安全随机在字符集中无偏取一个字符（拒绝采样，避免取模偏置） */
function pickChar(chars) {
  const len = chars.length
  if (len <= 0) return ''
  // 2^32 内能被 len 整除的最大边界，超出的采样丢弃
  const max = 4294967296
  const limit = max - (max % len)
  const buf = new Uint32Array(1)
  let v = 0
  do {
    const bytes = csprng.getRandomValues(4)
    buf[0] = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]
    v = buf[0] >>> 0
  } while (v >= limit)
  return chars.charAt(v % len)
}

/** Fisher-Yates 安全洗牌（就地） */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const bytes = csprng.getRandomValues(4)
    const r = (((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0) % (i + 1)
    const tmp = arr[i]
    arr[i] = arr[r]
    arr[r] = tmp
  }
  return arr
}

const generatorService = {
  /**
   * 生成强密码。
   * @param {Object} [opts] 配置：length / upper / lower / digits / symbols / excludeAmbiguous
   * @returns {string}
   */
  generate: function generate(opts) {
    // 注意：GENERATOR_DEFAULTS 的键为大写常量（UPPER/LOWER/...），
    // 这里统一映射为小写选项名，避免默认值因大小写不匹配而丢失（曾导致空字符池 bug）。
    const defaults = {
      length: GENERATOR_DEFAULTS.LENGTH,
      upper: GENERATOR_DEFAULTS.UPPER,
      lower: GENERATOR_DEFAULTS.LOWER,
      digits: GENERATOR_DEFAULTS.DIGITS,
      symbols: GENERATOR_DEFAULTS.SYMBOLS,
      excludeAmbiguous: GENERATOR_DEFAULTS.EXCLUDE_AMBIGUOUS
    }
    const o = Object.assign({}, defaults, opts || {})
    let length = Number(o.length)
    if (!Number.isInteger(length) || length < GENERATOR_DEFAULTS.MIN_LENGTH || length > GENERATOR_DEFAULTS.MAX_LENGTH) {
      length = GENERATOR_DEFAULTS.LENGTH
    }

    let lower = CHAR_SETS.LOWER
    let upper = CHAR_SETS.UPPER
    let digits = o.excludeAmbiguous ? CHAR_SETS.DIGITS_SAFE : CHAR_SETS.DIGITS
    let symbols = CHAR_SETS.SYMBOLS

    if (o.excludeAmbiguous) {
      const drop = function (s) {
        let out = ''
        for (let i = 0; i < s.length; i++) {
          if (CHAR_SETS.AMBIGUOUS.indexOf(s.charAt(i)) === -1) out += s.charAt(i)
        }
        return out
      }
      lower = drop(lower)
      upper = drop(upper)
      symbols = drop(symbols)
    }

    const pools = []
    if (o.lower) pools.push(lower)
    if (o.upper) pools.push(upper)
    if (o.digits) pools.push(digits)
    if (o.symbols) pools.push(symbols)
    if (pools.length === 0) {
      throw createError(ERROR_CODES.VALIDATION, '至少选择一种字符类型')
    }

    // 保证每个选中类型至少出现一次
    const result = []
    for (let i = 0; i < pools.length && i < length; i++) result.push(pickChar(pools[i]))

    const all = pools.join('')
    while (result.length < length) result.push(pickChar(all))
    return shuffle(result).join('').slice(0, length)
  },

  /**
   * 估算密码强度（0-100），用于 UI 指示，不做安全承诺。
   * @param {string} pwd 密码
   * @returns {number}
   */
  strength: function strength(pwd) {
    const s = String(pwd || '')
    if (!s) return 0
    let score = 0
    score += Math.min(s.length * 3, 45)
    if (/[a-z]/.test(s)) score += 10
    if (/[A-Z]/.test(s)) score += 10
    if (/[0-9]/.test(s)) score += 10
    if (/[^A-Za-z0-9]/.test(s)) score += 15
    if (s.length >= 16) score += 10
    return Math.max(0, Math.min(100, score))
  }
}

export default generatorService
