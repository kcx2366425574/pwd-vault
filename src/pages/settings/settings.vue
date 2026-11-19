<template>
  <view class="settings-page">
    <view class="group">
      <view class="group-title">安全</view>
      <view class="cell" @tap="changeMaster">
        <text class="cell-label">修改主密码</text><text class="cell-arrow">›</text>
      </view>
      <view class="cell">
        <text class="cell-label">生物识别解锁</text>
        <switch :checked="biometricEnabled" @change="toggleBiometric" color="#3a6ff8" />
      </view>
      <view class="cell">
        <text class="cell-label">防截屏</text>
        <switch :checked="secureScreen" @change="toggleSecure" color="#3a6ff8" />
      </view>
      <view class="cell" @tap="lockNow">
        <text class="cell-label">立即锁定</text><text class="cell-arrow">›</text>
      </view>
    </view>

    <view class="group">
      <view class="group-title">通用</view>
      <view class="cell">
        <text class="cell-label">自动锁定时长</text>
        <picker mode="selector" :range="lockLabels" :value="lockIndex" @change="onLockTime">
          <text class="cell-value">{{ currentLockLabel }} ▾</text>
        </picker>
      </view>
      <view class="cell">
        <text class="cell-label">主题</text>
        <picker mode="selector" :range="themeLabels" :value="themeIndex" @change="onTheme">
          <text class="cell-value">{{ themeLabels[themeIndex] }} ▾</text>
        </picker>
      </view>
      <view class="cell">
        <text class="cell-label">语言</text>
        <picker mode="selector" :range="langLabels" :value="langIndex" @change="onLang">
          <text class="cell-value">{{ langLabels[langIndex] }} ▾</text>
        </picker>
      </view>
    </view>

    <view class="group">
      <view class="group-title">数据</view>
      <view class="cell" @tap="goPage('/pages/category/category')"><text class="cell-label">分类管理</text><text class="cell-arrow">›</text></view>
      <view class="cell" @tap="goPage('/pages/tag/tag')"><text class="cell-label">标签管理</text><text class="cell-arrow">›</text></view>
      <view class="cell" @tap="goPage('/pages/import-export/import-export')"><text class="cell-label">导入与导出</text><text class="cell-arrow">›</text></view>
      <view class="cell" @tap="goPage('/pages/reminders/reminders')"><text class="cell-label">更新提醒</text><text class="cell-arrow">›</text></view>
    </view>

    <view class="group">
      <view class="group-title">关于</view>
      <view class="cell" @tap="checkForUpdate">
        <text class="cell-label">在线升级</text>
        <text class="cell-value">{{ updateBadge }}</text>
        <text class="cell-arrow">›</text>
      </view>
    </view>

    <view class="version">{{ versionText }}</view>
  </view>
</template>

<script>
/**
 * 设置页：改密、生物识别开关、自动锁定、主题、语言、防截屏、数据管理入口。
 */
import authService from '../../services/auth-service.js'
import storage from '../../utils/storage.js'
import lockManager from '../../utils/lock-manager.js'
import biometric from '../../utils/biometric.js'
import i18n from '../../utils/i18n.js'
import eventBus from '../../utils/event-bus.js'
import { EVENTS, DEFAULT_SETTINGS, LOCK_OPTIONS_MS, THEME, LANGUAGES, normalizeError } from '../../utils/constants.js'
import { checkUpdate, downloadAndInstall, openReleasePage, loadUpdateInfo, APP_META } from '../../services/update-service.js'

const LOCK_LABELS = ['30 秒', '1 分钟', '3 分钟', '5 分钟']
const THEMES = [THEME.LIGHT, THEME.DARK, THEME.AUTO]
const THEME_LABELS = ['浅色', '深色', '跟随系统']
const LANGS = [LANGUAGES.ZH_CN, LANGUAGES.EN_US]
const LANG_LABELS = ['简体中文', 'English']

export default {
  name: 'SettingsPage',
  data: function () {
    return {
      settings: Object.assign({}, DEFAULT_SETTINGS),
      biometricEnabled: false,
      secureScreen: true,
      lockLabels: LOCK_LABELS,
      themeLabels: THEME_LABELS,
      langLabels: LANG_LABELS,
      updateInfo: null,
      checkingUpdate: false
    }
  },
  computed: {
    lockIndex: function () {
      const i = LOCK_OPTIONS_MS.indexOf(this.settings.autoLockMs)
      return i < 0 ? 1 : i
    },
    currentLockLabel: function () { return LOCK_LABELS[this.lockIndex] },
    themeIndex: function () {
      const i = THEMES.indexOf(this.settings.theme)
      return i < 0 ? 2 : i
    },
    langIndex: function () {
      const i = LANGS.indexOf(this.settings.language)
      return i < 0 ? 0 : i
    },
    versionText: function () { return '密码保险箱 v' + APP_META.versionName + ' · 本地优先 · E2EE' },
    updateBadge: function () {
      if (this.updateInfo && this.updateInfo.hasUpdate) return '发现 v' + this.updateInfo.latest.versionName
      return '检查更新'
    }
  },
  onShow: function () {
    this.reload()
    this.updateInfo = loadUpdateInfo()
  },
  methods: {
    reload: function () {
      const s = storage.readSettings()
      this.settings = Object.assign({}, DEFAULT_SETTINGS, s)
      this.biometricEnabled = !!this.settings.biometricEnabled
      this.secureScreen = this.settings.secureScreen !== false
      i18n.setLanguage(this.settings.language || LANGUAGES.ZH_CN)
    },
    save: function () {
      storage.writeSettings(this.settings)
      eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settings)
    },
    changeMaster: function () {
      const self = this
      uni.showModal({
        title: '修改主密码',
        editable: true,
        placeholderText: '请输入当前主密码',
        success: function (r1) {
          if (!r1.confirm || !r1.content) return
          uni.showModal({
            title: '设置新主密码',
            editable: true,
            placeholderText: '请输入新主密码（至少 8 位）',
            success: function (r2) {
              if (!r2.confirm || !r2.content) return
              try {
                authService.changeMasterPassword(r1.content, r2.content)
                uni.showToast({ title: '主密码已修改', icon: 'success' })
              } catch (e) {
                uni.showToast({ title: normalizeError(e).message, icon: 'none' })
              }
            }
          })
        }
      })
    },
    toggleBiometric: function (e) {
      const self = this
      const on = e.detail.value
      if (on) {
        biometric.isSupported().then(function (r) {
          if (!r.available) {
            self.biometricEnabled = false
            uni.showToast({ title: '当前设备不支持生物识别', icon: 'none' })
            return
          }
          self.settings.biometricEnabled = true
          self.biometricEnabled = true
          self.save()
        })
      } else {
        this.settings.biometricEnabled = false
        this.biometricEnabled = false
        this.save()
      }
    },
    toggleSecure: function (e) {
      this.secureScreen = e.detail.value
      this.settings.secureScreen = this.secureScreen
      this.save()
    },
    onLockTime: function (e) {
      const ms = LOCK_OPTIONS_MS[Number(e.detail.value)]
      this.settings.autoLockMs = ms
      lockManager.setDefaultTimeout(ms)
      this.save()
    },
    onTheme: function (e) {
      this.settings.theme = THEMES[Number(e.detail.value)]
      this.save()
    },
    onLang: function (e) {
      this.settings.language = LANGS[Number(e.detail.value)]
      i18n.setLanguage(this.settings.language)
      uni.setStorageSync('pv.lang', this.settings.language)
      this.save()
    },
    lockNow: function () {
      authService.lock()
      uni.reLaunch({ url: '/pages/index/index' })
    },
    checkForUpdate: function () {
      const self = this
      if (this.checkingUpdate) return
      uni.showLoading({ title: '检查中...' })
      this.checkingUpdate = true
      checkUpdate(this.settings).then(function (info) {
        uni.hideLoading()
        self.checkingUpdate = false
        self.updateInfo = info
        self.showUpdateDialog(info)
      }).catch(function (e) {
        uni.hideLoading()
        self.checkingUpdate = false
        uni.showToast({ title: (e && e.message) || '检查失败，请稍后重试', icon: 'none' })
      })
    },
    showUpdateDialog: function (info) {
      const self = this
      const latest = info.latest
      const title = info.hasUpdate ? '发现新版本 v' + latest.versionName : '当前已是最新版本'
      const notes = latest.notes || '无更新说明'
      const buttons = []
      if (latest.pageUrl) buttons.push('发布页')
      if (info.hasUpdate && latest.apkUrl) buttons.push('立即更新')
      uni.showModal({
        title: title,
        content: '当前 v' + info.current.versionName + '\n\n' + notes.slice(0, 300),
        confirmText: buttons.indexOf('立即更新') >= 0 ? '立即更新' : '知道了',
        showCancel: buttons.length > 0,
        cancelText: buttons.indexOf('发布页') >= 0 ? '发布页' : '知道了',
        success: function (r) {
          if (r.confirm && buttons.indexOf('立即更新') >= 0) self.doInstall(info)
          else if (r.cancel && buttons.indexOf('发布页') >= 0) openReleasePage(latest.pageUrl)
        }
      })
    },
    doInstall: function (info) {
      const self = this
      uni.showLoading({ title: '准备下载...' })
      downloadAndInstall(info, function (p) {
        if (p && typeof p.percent === 'number') uni.showLoading({ title: '下载 ' + p.percent + '%' })
      }).then(function (r) {
        uni.hideLoading()
        if (!r || !r.installed) openReleasePage(info.latest.pageUrl)
      }).catch(function (e) {
        uni.hideLoading()
        uni.showToast({ title: (e && e.message) || '下载失败', icon: 'none' })
        self.updateInfo = null
      })
    },
    goPage: function (url) { uni.navigateTo({ url: url }) }
  }
}
</script>

<style scoped>
.settings-page { min-height: 100vh; background: #f5f6fa; padding: 32rpx; }
.group { background: #fff; border-radius: 24rpx; margin-bottom: 24rpx; overflow: hidden; }
.group-title { font-size: 24rpx; color: #909399; padding: 24rpx 32rpx 8rpx; }
.cell { display: flex; align-items: center; justify-content: space-between; min-height: 96rpx; padding: 0 32rpx; border-bottom: 1rpx solid #f5f5f5; }
.cell:last-child { border-bottom: none; }
.cell-label { font-size: 30rpx; color: #303133; }
.cell-value, .cell-arrow { font-size: 26rpx; color: #909399; }
.cell-arrow { font-size: 40rpx; }
.version { text-align: center; font-size: 22rpx; color: #c0c4cc; margin-top: 40rpx; }
</style>
