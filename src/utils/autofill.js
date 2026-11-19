/**
 * 自动填充适配层：按域名匹配凭证 + 用户确认的扩展位封装。
 * 未装原生插件时，提供「复制凭证手动填充」降级。
 */
import autofillBridge from '../providers/autofill-bridge.js'
import { ERROR_CODES, createError } from './constants.js'
import clipboard from './clipboard.js'

/** 从 URL 提取主域名（简单实现，防钓鱼需精确匹配） */
export function extractDomain(url) {
  try {
    const s = String(url || '')
    const m = s.match(/^(?:https?:\/\/)?([^/:\s]+)/i)
    return m ? m[1].toLowerCase().replace(/^www\./, '') : ''
  } catch (e) {
    return ''
  }
}

const autofill = {
  /** @returns {boolean} 原生自动填充是否可用 */
  isAvailable: function isAvailable() { return autofillBridge.isAvailable() },

  /**
   * 按域名从条目中查找匹配凭证（需调用方先做用户确认）。
   * @param {string} domain 目标域名
   * @param {Object[]} entries 明文条目
   * @returns {Object[]} 域名精确匹配的条目
   */
  matchEntries: function matchEntries(domain, entries) {
    const d = extractDomain(domain)
    if (!d) return []
    return (entries || []).filter(function (e) {
      if (e.deleted) return false
      return extractDomain(e.url) === d
    })
  },

  /**
   * 降级填充：把凭证复制到剪贴板（由用户手动粘贴），密码复制遵循 TTL 清空策略。
   * @param {Object} entry 明文条目
   * @returns {boolean}
   */
  fallbackCopy: function fallbackCopy(entry) {
    if (!entry || !entry.password) return false
    clipboard.copy(entry.password)
    return true
  }
}

export default autofill
