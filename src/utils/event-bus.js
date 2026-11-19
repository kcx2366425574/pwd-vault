/**
 * 全局事件总线（框架无关的自实现，Vue2/Vue3/H5/App 全兼容）。
 *
 * 原 Vue2 版本依赖 new Vue().$on，Vue3 已移除这些 API；改为平台无关的
 * Map 发布订阅实现，避免引入 vue 依赖，H5 浏览器与 App 端行为一致。
 *
 * 事件名统一在 constants.js 的 EVENTS 中声明，禁止硬编码字符串。
 * 事件载荷禁止携带明文密码、派生密钥或校验块原文。
 */
import { EVENTS, ERROR_CODES } from './constants.js'
import logger from './logger.js'

/** 事件名 -> 监听函数数组 */
const listeners = Object.create(null)

/** 允许广播的事件白名单，防止误用未约定事件名 */
const ALLOWED_EVENTS = Object.create(null)
Object.keys(EVENTS).forEach(function (key) {
  ALLOWED_EVENTS[EVENTS[key]] = true
})

const eventBus = {
  /**
   * 订阅事件。
   * @param {string} evt 事件名（见 EVENTS）
   * @param {Function} fn 回调
   */
  on: function on(evt, fn) {
    if (!ALLOWED_EVENTS[evt] || typeof fn !== 'function') {
      logger.error(ERROR_CODES.UNKNOWN, 'EVENT_ON')
      return
    }
    if (!listeners[evt]) listeners[evt] = []
    listeners[evt].push({ fn: fn, once: false })
  },

  /**
   * 订阅一次性事件。
   * @param {string} evt 事件名
   * @param {Function} fn 回调
   */
  once: function once(evt, fn) {
    if (!ALLOWED_EVENTS[evt] || typeof fn !== 'function') {
      logger.error(ERROR_CODES.UNKNOWN, 'EVENT_ONCE')
      return
    }
    if (!listeners[evt]) listeners[evt] = []
    listeners[evt].push({ fn: fn, once: true })
  },

  /**
   * 取消订阅。
   * @param {string} evt 事件名
   * @param {Function} [fn] 回调；不传则取消该事件全部监听
   */
  off: function off(evt, fn) {
    if (!ALLOWED_EVENTS[evt] || !listeners[evt]) return
    if (typeof fn === 'function') {
      listeners[evt] = listeners[evt].filter(function (item) { return item.fn !== fn })
    } else {
      delete listeners[evt]
    }
  },

  /**
   * 广播事件。on/once 回调都在 try 中执行，单个监听器异常不影响其它监听器。
   * @param {string} evt 事件名
   * @param {*} [data] 载荷（禁止明文）
   */
  emit: function emit(evt, data) {
    if (!ALLOWED_EVENTS[evt] || !listeners[evt]) return
    const current = listeners[evt].slice()
    const removeOnce = []
    current.forEach(function (item, index) {
      try {
        item.fn(data)
      } catch (e) {
        logger.error(ERROR_CODES.UNKNOWN, 'EVENT_EMIT')
      }
      if (item.once) removeOnce.push(item)
    })
    if (removeOnce.length) {
      listeners[evt] = listeners[evt].filter(function (item) { return removeOnce.indexOf(item) === -1 })
    }
  },

  /** 清空所有监听（测试/重置用） */
  clear: function clear() {
    Object.keys(listeners).forEach(function (k) { delete listeners[k] })
  }
}

export default eventBus
