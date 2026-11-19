/**
 * 更新提醒服务：基于条目的 remindAt 时间戳，筛选到期需更换密码的条目。
 */
import entryService from './entry-service.js'

const reminderService = {
  /**
   * 列出到期/将到期的条目。
   * @param {number} [withinDays] 提前天数（默认 0，即只看已到期）
   * @returns {Object[]}
   */
  due: function due(withinDays) {
    const now = Date.now()
    const horizon = now + (Number(withinDays) || 0) * 24 * 60 * 60 * 1000
    return entryService.listAll().filter(function (e) {
      const t = Number(e.remindAt) || 0
      return t > 0 && t <= horizon
    }).sort(function (a, b) { return a.remindAt - b.remindAt })
  },

  /**
   * 设置提醒（修改条目的 remindAt）。
   * @param {string} id 条目 id
   * @param {number} remindAt 毫秒时间戳（0 表示取消）
   */
  setReminder: function setReminder(id, remindAt) {
    const entry = entryService.get(id)
    if (!entry) return false
    entryService.update(id, Object.assign({}, entry, { remindAt: Number(remindAt) || 0 }))
    return true
  }
}

export default reminderService
