/**
 * 安全锁定管理器：自动锁定计时器 + 前后台监听 + 锁定动作编排。
 *
 * 锁定动作顺序：wipe 会话密钥 -> 清空剪贴板 -> 清空内存明文 -> 广播 auth:locked。
 * 明文数据的清理由 auth-service 订阅 auth:locked 后调用 VaultService.clearMemory() 完成。
 */
import { EVENTS, DEFAULT_LOCK_MS, ERROR_CODES } from './constants.js'
import eventBus from './event-bus.js'
import clipboard from './clipboard.js'
import sessionGuard from './session-guard.js'
import logger from './logger.js'

let timer = null
let lifecycleBound = false
let currentTimeoutMs = DEFAULT_LOCK_MS
let lastActivityAt = Date.now()

/**
 * 校验并设置自动锁定时长。
 * @param {number} ms 毫秒
 */
function applyTimeout(ms) {
  const value = Number(ms)
  if (Number.isFinite(value) && value >= 10000 && value <= 3600000) {
    currentTimeoutMs = value
  }
}

/** 执行一次锁定编排 */
function performLock(reason) {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  if (sessionGuard.isUnlocked()) {
    sessionGuard.lock()
  }
  clipboard.clearNow()
  eventBus.emit(EVENTS.AUTH_LOCKED, { reason: reason || 'timeout', at: Date.now() })
}

const lockManager = {
  /**
   * 设置默认自动锁定时长（由 settings 模块调用）。
   * @param {number} ms 毫秒
   */
  setDefaultTimeout: function setDefaultTimeout(ms) {
    applyTimeout(ms)
    if (timer !== null) this.resetTimer()
  },

  /**
   * 启动自动锁定计时器（已有计时器先取消）。
   * @param {number} [ms] 毫秒，省略则使用当前默认时长
   */
  startTimer: function startTimer(ms) {
    if (ms !== undefined) applyTimeout(ms)
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (!sessionGuard.isUnlocked()) return
    lastActivityAt = Date.now()
    const self = this
    timer = setTimeout(function () {
      timer = null
      performLock('timeout')
      logger.debug('LOCK', 1)
    }, currentTimeoutMs)
  },

  /** 用户有操作时重置计时器（总是重新开始计时） */
  resetTimer: function resetTimer() {
    lastActivityAt = Date.now()
    this.startTimer(currentTimeoutMs)
  },

  /** 停止计时器但不执行锁定（用于已锁定时清理） */
  stopTimer: function stopTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  },

  /**
   * 立即锁定（手动锁定/后台/超时统一入口）。
   * @param {string} [reason] 'manual' | 'background' | 'timeout'
   */
  lockNow: function lockNow(reason) {
    performLock(reason || 'manual')
  },

  /** 回前台：未解锁则保持锁定，已解锁则重置计时器 */
  onAppShow: function onAppShow() {
    if (sessionGuard.isUnlocked()) {
      this.resetTimer()
    }
  },

  /** 切后台：立即锁定 */
  onAppHide: function onAppHide() {
    if (!sessionGuard.isUnlocked()) return
    this.lockNow('background')
  },

  /**
   * 绑定平台生命周期监听。App.vue 的 onShow/onHide 已覆盖主流场景，
   * 此处额外监听 plus 的 pause/resume 以覆盖息屏等系统事件。
   */
  bindLifecycle: function bindLifecycle() {
    if (lifecycleBound) return
    lifecycleBound = true

    // #ifdef APP-PLUS
    try {
      if (typeof plus !== 'undefined' && plus.globalEvent && typeof plus.globalEvent.addEventListener === 'function') {
        const self = this
        plus.globalEvent.addEventListener('pause', function () {
          self.onAppHide()
        })
        plus.globalEvent.addEventListener('resume', function () {
          self.onAppShow()
        })
      }
    } catch (e) {
      logger.error(ERROR_CODES.UNKNOWN, 'LOCK')
    }
    // #endif
  },

  /**
   * 获取距上次活动的毫秒数（调试/测试用）。
   * @returns {number}
   */
  getIdleMs: function getIdleMs() {
    return Date.now() - lastActivityAt
  },

  /**
   * 获取当前自动锁定时长。
   * @returns {number}
   */
  getTimeout: function getTimeout() {
    return currentTimeoutMs
  }
}

export default lockManager
