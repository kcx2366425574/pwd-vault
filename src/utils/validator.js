/**
 * 校验工具：主密码强度、条目必填项、名称与整数范围校验。
 *
 * 明文纪律：本文件只做纯计算，不记录任何输入内容。
 */

/** 常见弱密码黑名单（小写化后精确匹配） */
const WEAK_PASSWORDS = [
  '12345678', '123456789', '1234567890', '123123123', 'password', 'password1',
  'qwerty123', 'abc123456', '11111111', '00000000', 'iloveyou', 'admin123',
  'letmein123', 'welcome123', 'rootroot', '1234qwer'
]

/** 连续序列片段（小写化后检测） */
const SEQUENCE_PATTERN = /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|efgh|fghi|ghij|qwer|wert|erty|tyui|asdf|sdfg|dfgh|zxcv)/i

/**
 * 判断空白字符串。
 * @param {*} value 输入
 * @returns {boolean}
 */
export function isBlank(value) {
  return value === null || value === undefined || String(value).trim().length === 0
}

/**
 * 判断是否为常见弱密码。
 * @param {string} pwd 密码
 * @returns {boolean}
 */
export function isCommonPassword(pwd) {
  if (typeof pwd !== 'string') return true
  return WEAK_PASSWORDS.indexOf(pwd.toLowerCase()) >= 0
}

/**
 * 分析密码强度（纯函数）。
 * @param {string} pwd 密码
 * @returns {{length:number, classes:number, score:number, label:string, suggestions:string[],
 *   hasLower:boolean, hasUpper:boolean, hasDigit:boolean, hasSymbol:boolean}}
 */
export function analyzePassword(pwd) {
  const value = typeof pwd === 'string' ? pwd : ''
  let hasLower = false
  let hasUpper = false
  let hasDigit = false
  let hasSymbol = false

  for (let i = 0; i < value.length; i++) {
    const ch = value.charAt(i)
    if (ch >= 'a' && ch <= 'z') hasLower = true
    else if (ch >= 'A' && ch <= 'Z') hasUpper = true
    else if (ch >= '0' && ch <= '9') hasDigit = true
    else hasSymbol = true
  }

  const classes = (hasLower ? 1 : 0) + (hasUpper ? 1 : 0) + (hasDigit ? 1 : 0) + (hasSymbol ? 1 : 0)
  let score = 0
  if (value.length >= 8) score += 1
  if (value.length >= 12) score += 1
  if (classes >= 3) score += 1
  if (classes === 4 && value.length >= 12) score += 1

  if (isCommonPassword(value)) score = 0
  if (/(.)\1{3,}/.test(value)) score = Math.max(0, score - 1)
  if (SEQUENCE_PATTERN.test(value)) score = Math.max(0, score - 1)
  score = Math.max(0, Math.min(4, score))

  const labels = ['极弱', '弱', '中等', '强', '极强']
  const suggestions = []
  if (value.length < 12) suggestions.push('建议使用 12 位以上')
  if (!hasLower) suggestions.push('建议包含小写字母')
  if (!hasUpper) suggestions.push('建议包含大写字母')
  if (!hasDigit) suggestions.push('建议包含数字')
  if (!hasSymbol) suggestions.push('建议包含符号')
  if (isCommonPassword(value)) suggestions.push('不能使用常见密码')
  if (SEQUENCE_PATTERN.test(value)) suggestions.push('避免使用连续字符序列')

  return {
    length: value.length,
    classes: classes,
    score: score,
    label: labels[score],
    suggestions: suggestions,
    hasLower: hasLower,
    hasUpper: hasUpper,
    hasDigit: hasDigit,
    hasSymbol: hasSymbol
  }
}

/**
 * 校验主密码策略（至少 8 位、不少于 3 类字符、强度不低于「弱」）。
 * @param {string} pwd 主密码
 * @returns {{valid: boolean, score: number, label: string, errors: string[], suggestions: string[]}}
 */
export function validateMasterPassword(pwd) {
  const analysis = analyzePassword(pwd)
  const errors = []

  if (analysis.length < 8) errors.push('主密码至少需要 8 位')
  if (analysis.length > 64) errors.push('主密码不能超过 64 位')
  if (analysis.classes < 3) errors.push('需包含大写字母、小写字母、数字、符号中的至少 3 类')
  if (isCommonPassword(pwd)) errors.push('不能使用常见弱密码')
  if (analysis.score < 2) errors.push('主密码强度过低，请增加长度或字符种类')

  return {
    valid: errors.length === 0,
    score: analysis.score,
    label: analysis.label,
    errors: errors,
    suggestions: analysis.suggestions
  }
}

/**
 * 校验条目必填字段（网站名、密码）。
 * @param {Object} dto 条目
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateEntry(dto) {
  const errors = []
  const value = dto && typeof dto === 'object' ? dto : {}
  if (isBlank(value.site)) errors.push('网站名称不能为空')
  if (isBlank(value.password)) errors.push('密码不能为空')
  if (value.url && String(value.url).length > 512) errors.push('URL 过长')
  if (value.note && String(value.note).length > 2000) errors.push('备注过长')
  return { valid: errors.length === 0, errors: errors }
}

/**
 * 校验分类/标签名称。
 * @param {string} name 名称
 * @param {number} [maxLen] 最大长度
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateName(name, maxLen) {
  const limit = maxLen || 24
  const errors = []
  if (isBlank(name)) errors.push('名称不能为空')
  if (typeof name === 'string' && name.length > limit) errors.push('名称不能超过 ' + limit + ' 个字符')
  return { valid: errors.length === 0, errors: errors }
}

/**
 * 把整数值限制在范围内。
 * @param {*} value 输入
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @param {number} fallback 非法时默认值
 * @returns {number}
 */
export function clampInt(value, min, max, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.round(num)))
}

export default {
  isBlank: isBlank,
  isCommonPassword: isCommonPassword,
  analyzePassword: analyzePassword,
  validateMasterPassword: validateMasterPassword,
  validateEntry: validateEntry,
  validateName: validateName,
  clampInt: clampInt
}
