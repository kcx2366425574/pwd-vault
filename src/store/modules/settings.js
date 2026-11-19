/**
 * 设置状态模块。
 *
 * 全部设置项均为非敏感数据，可持久化到 pv.settings；
 * 任何变更都广播 settings:changed，由 App.vue 统一应用主题/防截屏/锁定策略。
 */
import {
  DEFAULT_SETTINGS, EVENTS, CLIPBOARD_TTL_MS, CLIPBOARD_TTL_MIN_MS, CLIPBOARD_TTL_MAX_MS,
  LOCK_OPTIONS_MS, THEME, LANGUAGES
} from '../../utils/constants.js'
import storage from '../../utils/storage.js'
import lockManager from '../../utils/lock-manager.js'
import eventBus from '../../utils/event-bus.js'

const state = Object.assign({}, DEFAULT_SETTINGS)

const mutations = {
  MERGE_SETTINGS: function MERGE_SETTINGS(state, patch) {
    const source = patch || {}
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      if (source[key] !== undefined) state[key] = source[key]
    })
  },
  SET_AUTO_LOCK_MS: function SET_AUTO_LOCK_MS(state, value) {
    state.autoLockMs = value
  },
  SET_CLIPBOARD_TTL_MS: function SET_CLIPBOARD_TTL_MS(state, value) {
    state.clipboardTtlMs = value
  },
  SET_THEME: function SET_THEME(state, value) {
    state.theme = value
  },
  SET_LANGUAGE: function SET_LANGUAGE(state, value) {
    state.language = value
  },
  SET_SECURE_SCREEN: function SET_SECURE_SCREEN(state, value) {
    state.secureScreen = !!value
  },
  SET_BIOMETRIC_ENABLED: function SET_BIOMETRIC_ENABLED(state, value) {
    state.biometricEnabled = !!value
  },
  SET_AUTO_SYNC: function SET_AUTO_SYNC(state, value) {
    state.autoSync = !!value
  }
}

/** 从 state 生成可持久化的纯对象并广播变更 */
function persistAndNotify(state) {
  const snapshot = {}
  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    snapshot[key] = state[key]
  })
  storage.writeSettings(snapshot)
  lockManager.setDefaultTimeout(state.autoLockMs)
  eventBus.emit(EVENTS.SETTINGS_CHANGED, snapshot)
}

const actions = {
  /** 从 Storage 载入设置（非敏感） */
  loadSettings: function loadSettings(context) {
    const saved = storage.readSettings()
    const patch = {}
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      if (saved[key] !== undefined) patch[key] = saved[key]
    })
    // 范围校正，防止被篡改为不安全值
    if (LOCK_OPTIONS_MS.indexOf(patch.autoLockMs) < 0) patch.autoLockMs = DEFAULT_SETTINGS.autoLockMs
    patch.clipboardTtlMs = Math.min(
      CLIPBOARD_TTL_MAX_MS,
      Math.max(CLIPBOARD_TTL_MIN_MS, Number(patch.clipboardTtlMs) || DEFAULT_SETTINGS.clipboardTtlMs)
    )
    if ([THEME.LIGHT, THEME.DARK, THEME.AUTO].indexOf(patch.theme) < 0) patch.theme = DEFAULT_SETTINGS.theme
    if ([LANGUAGES.ZH_CN, LANGUAGES.EN_US].indexOf(patch.language) < 0) patch.language = DEFAULT_SETTINGS.language
    context.commit('MERGE_SETTINGS', patch)
    lockManager.setDefaultTimeout(context.state.autoLockMs)
    return context.state
  },

  /** 批量更新设置项 */
  updateSettings: function updateSettings(context, patch) {
    context.commit('MERGE_SETTINGS', patch || {})
    persistAndNotify(context.state)
    return context.state
  },

  /** 设置自动锁定时长 */
  setAutoLockMs: function setAutoLockMs(context, value) {
    const ms = LOCK_OPTIONS_MS.indexOf(Number(value)) >= 0 ? Number(value) : DEFAULT_SETTINGS.autoLockMs
    context.commit('SET_AUTO_LOCK_MS', ms)
    persistAndNotify(context.state)
  },

  /** 设置剪贴板清空时长 */
  setClipboardTtlMs: function setClipboardTtlMs(context, value) {
    const ms = Math.min(CLIPBOARD_TTL_MAX_MS, Math.max(CLIPBOARD_TTL_MIN_MS, Number(value) || CLIPBOARD_TTL_MS))
    context.commit('SET_CLIPBOARD_TTL_MS', ms)
    persistAndNotify(context.state)
  },

  /** 设置主题 */
  setTheme: function setTheme(context, value) {
    if ([THEME.LIGHT, THEME.DARK, THEME.AUTO].indexOf(value) < 0) return
    context.commit('SET_THEME', value)
    persistAndNotify(context.state)
  },

  /** 设置语言 */
  setLanguage: function setLanguage(context, value) {
    if ([LANGUAGES.ZH_CN, LANGUAGES.EN_US].indexOf(value) < 0) return
    context.commit('SET_LANGUAGE', value)
    persistAndNotify(context.state)
  },

  /** 切换防截屏 */
  setSecureScreen: function setSecureScreen(context, value) {
    context.commit('SET_SECURE_SCREEN', value)
    persistAndNotify(context.state)
  },

  /** 设置生物识别开关状态（真实认证在 T04 接入） */
  setBiometricEnabled: function setBiometricEnabled(context, value) {
    context.commit('SET_BIOMETRIC_ENABLED', value)
    persistAndNotify(context.state)
  },

  /** 设置自动同步开关 */
  setAutoSync: function setAutoSync(context, value) {
    context.commit('SET_AUTO_SYNC', value)
    persistAndNotify(context.state)
  }
}

export default {
  namespaced: true,
  state: state,
  mutations: mutations,
  actions: actions,
  getters: {
    all: function all(state) {
      return Object.assign({}, state)
    }
  }
}
