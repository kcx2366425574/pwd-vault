/**
 * 密码安全体检纯函数：弱密码、重复密码、陈旧密码检测。
 * 纯函数，无副作用，便于独立测试。
 */
import { CHAR_SETS } from './constants.js'

/** 估算密码强度分（0-100） */
function scoreOf(pwd) {
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

/** 常见弱密码字典（小写） */
const COMMON_WEAK = ['password', '123456', '12345678', 'qwerty', '111111', 'abc123', 'admin', 'letmein', 'welcome', 'iloveyou', '000000', '123123', '654321']

/**
 * 审计条目列表。
 * @param {Object[]} entries 明文条目
 * @param {number} staleDays 陈旧阈值（天），默认 180
 * @returns {{weak:Object[], reused:Object[], stale:Object[], total:number, score:number}}
 */
function audit(entries, staleDays) {
  const list = Array.isArray(entries) ? entries.filter(function (e) { return !e.deleted && e.password }) : []
  const days = Number(staleDays) || 180
  const now = Date.now()
  const staleMs = days * 24 * 60 * 60 * 1000

  const weak = []
  const byPassword = Object.create(null)
  const stale = []

  list.forEach(function (e) {
    const score = scoreOf(e.password)
    const lower = String(e.password).toLowerCase()
    if (score < 60 || COMMON_WEAK.indexOf(lower) !== -1) {
      weak.push({ id: e.id, site: e.site, score: score, reason: score < 60 ? '强度过低' : '常见弱密码' })
    }
    if (!byPassword[e.password]) byPassword[e.password] = []
    byPassword[e.password].push({ id: e.id, site: e.site })
    const updated = Number(e.updatedAt) || 0
    if (updated > 0 && now - updated > staleMs) {
      stale.push({ id: e.id, site: e.site, days: Math.floor((now - updated) / (24 * 60 * 60 * 1000)) })
    }
  })

  const reused = []
  Object.keys(byPassword).forEach(function (pwd) {
    const group = byPassword[pwd]
    if (group.length > 1) reused.push({ sites: group.map(function (g) { return g.site }), ids: group.map(function (g) { return g.id }) })
  })

  const issues = weak.length + reused.length + stale.length
  const total = list.length
  const score = total === 0 ? 100 : Math.max(0, 100 - Math.round((issues / total) * 40) - Math.round((weak.length / total) * 60))

  return { weak: weak, reused: reused, stale: stale, total: total, score: Math.max(0, Math.min(100, score)) }
}

export default { audit: audit, scoreOf: scoreOf }
