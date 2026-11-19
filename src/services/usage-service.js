/**
 * 使用记录服务：基于条目的 usageCount / lastUsedAt 提供统计视图。
 * 记录在条目上随库加密保存，无独立明文日志。
 */
import entryService from './entry-service.js'

const usageService = {
  /** @returns {Object[]} 按使用次数降序的条目 */
  mostUsed: function mostUsed(limit) {
    const list = entryService.listAll().slice().sort(function (a, b) {
      return (b.usageCount || 0) - (a.usageCount || 0)
    })
    return typeof limit === 'number' ? list.slice(0, limit) : list
  },

  /** @returns {Object} 汇总统计 */
  summary: function summary() {
    const list = entryService.listAll()
    let totalUses = 0
    let everUsed = 0
    list.forEach(function (e) {
      const n = Number(e.usageCount) || 0
      totalUses += n
      if (n > 0) everUsed++
    })
    return { totalEntries: list.length, totalUses: totalUses, everUsed: everUsed }
  }
}

export default usageService
