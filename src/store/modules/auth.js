/**
 * 认证状态模块。
 *
 * 安全约定：state 只保存解锁布尔值与退避时间戳，绝不保存主密码、密钥或明文条目。
 */
import authService from '../../services/auth-service.js'
import { EVENTS, ERROR_CODES, createError, normalizeError } from '../../utils/constants.js'
import eventBus from '../../utils/event-bus.js'
import logger from '../../utils/logger.js'

const state = {
  unlocked: false,
  hasVault: false,
  failCount: 0,
  lockedUntil: 0,
  biometricEnabled: false
}

const mutations = {
  SET_UNLOCKED: function SET_UNLOCKED(state, value) {
    state.unlocked = !!value
  },
  SET_HAS_VAULT: function SET_HAS_VAULT(state, value) {
    state.hasVault = !!value
  },
  SET_FAIL_COUNT: function SET_FAIL_COUNT(state, value) {
    state.failCount = Number(value) || 0
  },
  SET_LOCKED_UNTIL: function SET_LOCKED_UNTIL(state, value) {
    state.lockedUntil = Number(value) || 0
  },
  SET_BIOMETRIC_ENABLED: function SET_BIOMETRIC_ENABLED(state, value) {
    state.biometricEnabled = !!value
  }
}

/** 把服务层的退避状态同步到 state */
function syncBackoff(commit) {
  const status = authService.getBackoffStatus()
  commit('SET_FAIL_COUNT', status.failCount)
  commit('SET_LOCKED_UNTIL', status.retryAfter > 0 ? Date.now() + status.retryAfter * 1000 : 0)
}

const actions = {
  /** 启动时检测是否已存在密码库 */
  checkVault: function checkVault(context) {
    context.commit('SET_HAS_VAULT', authService.hasVault())
  },

  /** 首次设置主密码 */
  setup: function setup(context, pwd) {
    try {
      authService.setupMasterPassword(pwd)
      context.commit('SET_UNLOCKED', true)
      context.commit('SET_HAS_VAULT', true)
      syncBackoff(context.commit)
      return true
    } catch (e) {
      syncBackoff(context.commit)
      logger.error(normalizeError(e).code, 'AUTH')
      throw e
    }
  },

  /** 主密码解锁 */
  unlock: function unlock(context, pwd) {
    try {
      authService.unlock(pwd)
      context.commit('SET_UNLOCKED', true)
      syncBackoff(context.commit)
      return true
    } catch (e) {
      syncBackoff(context.commit)
      logger.error(normalizeError(e).code, 'AUTH')
      throw e
    }
  },

  /** 生物识别解锁（当前降级为 false，T04 接入真实适配层） */
  unlockByBiometric: function unlockByBiometric(context) {
    try {
      const ok = authService.unlockByBiometric()
      if (ok) context.commit('SET_UNLOCKED', true)
      syncBackoff(context.commit)
      return ok
    } catch (e) {
      syncBackoff(context.commit)
      logger.error(normalizeError(e).code, 'BIOMETRIC')
      throw e
    }
  },

  /** 手动锁定 */
  lock: function lock(context) {
    authService.lock()
    context.commit('SET_UNLOCKED', false)
    syncBackoff(context.commit)
  },

  /** 修改主密码 */
  changePassword: function changePassword(context, payload) {
    const params = payload || {}
    try {
      authService.changeMasterPassword(params.oldPwd, params.newPwd)
      syncBackoff(context.commit)
      return true
    } catch (e) {
      syncBackoff(context.commit)
      logger.error(normalizeError(e).code, 'AUTH')
      throw e
    }
  },

  /** 刷新退避倒计时状态 */
  refreshBackoff: function refreshBackoff(context) {
    syncBackoff(context.commit)
  },

  /** 由根 Store 在收到全局锁定事件时调用 */
  handleLocked: function handleLocked(context) {
    context.commit('SET_UNLOCKED', false)
  },

  /** 由根 Store 在收到全局解锁事件时调用 */
  handleUnlocked: function handleUnlocked(context) {
    context.commit('SET_UNLOCKED', true)
    context.commit('SET_HAS_VAULT', true)
  }
}

export default {
  namespaced: true,
  state: state,
  mutations: mutations,
  actions: actions,
  getters: {
    isUnlocked: function isUnlocked(state) {
      return state.unlocked
    },
    retryAfter: function retryAfter(state) {
      return state.lockedUntil > Date.now()
        ? Math.ceil((state.lockedUntil - Date.now()) / 1000)
        : 0
    }
  }
}
