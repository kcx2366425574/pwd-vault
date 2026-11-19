<script>
/**
 * 应用根组件。
 * 职责：全局主题、全局锁定时机（切后台/唤醒）、防截屏开关、事件总线挂载。
 * 明文纪律：本文件不接触任何密码、密钥或密文。
 */
import { EVENTS, THEME, ERROR_CODES } from './utils/constants.js'
import eventBus from './utils/event-bus.js'
import lockManager from './utils/lock-manager.js'
import logger from './utils/logger.js'

export default {
  name: 'App',

  data: function data() {
    return {
      isDark: false
    }
  },

  computed: {
    /** 当前主题模式，来自 settings 模块（非敏感） */
    themeMode: function themeMode() {
      const settings = this.$store && this.$store.state && this.$store.state.settings
      return (settings && settings.theme) || THEME.AUTO
    },

    /** 当前防截屏开关，来自 settings 模块 */
    secureScreen: function secureScreen() {
      const settings = this.$store && this.$store.state && this.$store.state.settings
      return !!(settings && settings.secureScreen)
    }
  },

  onLaunch: function onLaunch() {
    // 载入非敏感设置项（自动锁定时长/主题/语言等）
    try {
      if (this.$store) this.$store.dispatch('settings/loadSettings')
    } catch (e) {
      logger.error(ERROR_CODES.UNKNOWN, 'BOOT')
    }

    this.bindEvents()
    this.applyTheme()
    this.applySecureScreen()

    // 绑定前后台生命周期监听（App 端为 plus 事件，H5 为页面可见性）
    lockManager.bindLifecycle()
  },

  onShow: function onShow() {
    // 回到前台：由 LockManager 判断是否需要立即锁定
    lockManager.onAppShow()
  },

  onHide: function onHide() {
    // 切入后台：立即锁定并 wipe 内存明文
    lockManager.onAppHide()
  },

  onError: function onError(err) {
    // 记录错误码而非错误对象，防止异常信息夹带敏感数据
    logger.error(ERROR_CODES.UNKNOWN, 'BOOT')
  },

  methods: {
    /** 注册全局事件监听 */
    bindEvents: function bindEvents() {
      const self = this
      eventBus.on(EVENTS.SETTINGS_CHANGED, function () {
        self.applyTheme()
        self.applySecureScreen()
        // 设置变化后按新时长重置自动锁定计时器
        lockManager.resetTimer()
      })
      eventBus.on(EVENTS.AUTH_UNLOCKED, function () {
        lockManager.resetTimer()
        self.applySecureScreen()
      })
      eventBus.on(EVENTS.AUTH_LOCKED, function () {
        lockManager.stopTimer()
      })
    },

    /** 应用主题到系统导航栏/窗口背景 */
    applyTheme: function applyTheme() {
      let dark = false
      if (this.themeMode === THEME.DARK) {
        dark = true
      } else if (this.themeMode === THEME.AUTO) {
        // #ifdef APP-PLUS
        try {
          if (typeof plus !== 'undefined' && plus.nativeObj && plus.nativeObj.env) {
            // 系统深色模式探测；不支持时保持浅色
            dark = false
          }
        } catch (e) {
          dark = false
        }
        // #endif
      }
      this.isDark = dark

      try {
        uni.setBackgroundColor({
          backgroundColor: dark ? '#12141A' : '#F5F6FA',
          top: true,
          bottom: true
        })
      } catch (e) {
        // H5 调试基座可能不支持，忽略即可
      }
    },

    /**
     * 应用防截屏（FLAG_SECURE）。仅 App 端生效，H5 降级为无操作。
     * 注意：这是可选纵深防御，不能替代加密存储。
     */
    applySecureScreen: function applySecureScreen() {
      // #ifdef APP-PLUS
      try {
        if (typeof plus === 'undefined' || !plus.android || !plus.android.runtimeMainActivity) return
        const activity = plus.android.runtimeMainActivity()
        const WindowClass = plus.android.importClass('android.view.Window')
        const window = activity.getWindow()
        if (!window || !WindowClass) return
        const flag = WindowClass.FLAG_SECURE
        if (this.secureScreen) {
          window.setFlags(flag, flag)
        } else {
          window.clearFlags(flag)
        }
      } catch (e) {
        logger.error(ERROR_CODES.UNKNOWN, 'BOOT')
      }
      // #endif
    }
  }
}
</script>

<style>
@import './styles/global.css';

.app-root {
  min-height: 100vh;
}
</style>
