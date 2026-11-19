/**
 * 剪贴板服务：复制敏感内容后倒计时自动清空；锁定立即清空。
 *
 * 安全约定：本文件不记录被复制的文本内容，只广播剩余秒数与清空事件。
 */
import { CLIPBOARD_TTL_MS, CLIPBOARD_TTL_MIN_MS, CLIPBOARD_TTL_MAX_MS, EVENTS, ERROR_CODES } from './constants.js'
import eventBus from './event-bus.js'
import logger from './logger.js'

let clearTimer = null
let remainingSeconds = 0

/**
 * 把 TTL 限制在允许范围内。
 * @param {number} ttl 期望毫秒数
 * @returns {number} 合法毫秒数
 */
function normalizeTtl(ttl) {
  const value = Number(ttl)
  if (!Number.isFinite(value) || value <= 0) return CLIPBOARD_TTL_MS
  return Math.min(CLIPBOARD_TTL_MAX_MS, Math.max(CLIPBOARD_TTL_MIN_MS, value))
}

const clipboard = {
  /**
   * 复制文本并启动自动清空倒计时。
   * @param {string} text 待复制文本（通常是密码，绝不打印）
   * @param {number} [ttl] 存活毫秒数
   */
  copy: function copy(text, ttl) {
    this.clearNow()
    const data = text === null || text === undefined ? '' : String(text)
    uni.setClipboardData({
      data: data,
      fail: function () {
        logger.error(ERROR_CODES.CLIPBOARD, 'CLIPBOARD')
      }
    })
    remainingSeconds = Math.ceil(normalizeTtl(ttl) / 1000)
    const self = this
    clearTimer = setInterval(function () {
      remainingSeconds -= 1
      if (remainingSeconds <= 0) {
        self.clearNow()
      } else {
        eventBus.emit(EVENTS.CLIPBOARD_CLEAR, { clearing: false, remaining: remainingSeconds })
      }
    }, 1000)
    eventBus.emit(EVENTS.CLIPBOARD_CLEAR, { clearing: false, remaining: remainingSeconds })
  },

  /**
   * 立即清空剪贴板并取消倒计时。
   */
  clearNow: function clearNow() {
    if (clearTimer !== null) {
      clearInterval(clearTimer)
      clearTimer = null
    }
    remainingSeconds = 0
    try {
      uni.setClipboardData({ data: '', fail: function () {} })
    } catch (e) {
      // 清空失败只记录错误码，不影响锁定流程
      logger.error(ERROR_CODES.CLIPBOARD, 'CLIPBOARD')
    }
    eventBus.emit(EVENTS.CLIPBOARD_CLEAR, { clearing: true, remaining: 0 })
  },

  /**
   * 获取剩余秒数（供 UI 显示倒计时）。
   * @returns {number}
   */
  getRemaining: function getRemaining() {
    return remainingSeconds
  }
}

export default clipboard
