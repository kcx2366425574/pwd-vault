<template>
  <view class="unlock-page">
    <view class="brand">
      <view class="brand-icon">🔐</view>
      <view class="brand-name">密码保险箱</view>
      <view class="brand-slogan">本地优先 · 端到端加密</view>
    </view>

    <view class="panel">
      <block v-if="!hasVault">
        <button class="primary-btn" @tap="goSetup">首次使用 · 设置主密码</button>
      </block>
      <block v-else>
        <view class="label">{{ t('masterPassword') }}</view>
        <pwd-input v-model="password" placeholder="请输入主密码以解锁" />
        <button class="primary-btn" :loading="loading" @tap="doUnlock">{{ t('unlock') }}</button>
        <button v-if="bioAvailable" class="ghost-btn" @tap="doBiometric">🔓 生物识别解锁</button>
        <view v-if="errorMsg" class="error">{{ errorMsg }}</view>
        <view v-if="retryAfter > 0" class="backoff">{{ backoffText }}</view>
        <view class="tip">忘记主密码将无法找回，加密数据不可恢复</view>
      </block>
    </view>
  </view>
</template>

<script>
/**
 * 启动/解锁页。主密码解锁 + 生物识别降级入口 + 错误退避倒计时。
 */
import authService from '../../services/auth-service.js'
import biometric from '../../utils/biometric.js'
import vaultService from '../../services/vault-service.js'
import generatorService from '../../services/generator-service.js'
import clipboard from '../../utils/clipboard.js'
import i18n from '../../utils/i18n.js'
import { normalizeError, ERROR_CODES } from '../../utils/constants.js'
import PwdInput from '../../components/pwd-input.vue'

export default {
  name: 'IndexPage',
  components: { PwdInput },
  data: function () {
    return {
      hasVault: false,
      password: '',
      loading: false,
      errorMsg: '',
      retryAfter: 0,
      bioAvailable: false,
      backoffTimer: null
    }
  },
  computed: {
    backoffText: function () { return this.t('backoff', this.retryAfter) }
  },
  onLoad: function () {
    this.hasVault = authService.hasVault()
  },
  onShow: function () {
    this.hasVault = authService.hasVault()
    this.refreshBackoff()
    this.checkBiometric()
    // 已解锁时直接进入密码库（例如从后台返回）
    if (authService.isUnlocked()) {
      uni.switchTab({ url: '/pages/vault/vault' })
    }
  },
  onUnload: function () {
    if (this.backoffTimer) clearInterval(this.backoffTimer)
  },
  methods: {
    t: function (key) { return i18n.t.apply(i18n, arguments) },
    goSetup: function () { uni.navigateTo({ url: '/pages/setup/setup' }) },
    checkBiometric: function () {
      const self = this
      biometric.isSupported().then(function (r) { self.bioAvailable = !!(r && r.available) })
    },
    refreshBackoff: function () {
      const self = this
      const status = authService.getBackoffStatus()
      this.retryAfter = status.inBackoff ? status.retryAfter : 0
      if (this.backoffTimer) { clearInterval(this.backoffTimer); this.backoffTimer = null }
      if (this.retryAfter > 0) {
        this.backoffTimer = setInterval(function () {
          const s = authService.getBackoffStatus()
          self.retryAfter = s.inBackoff ? s.retryAfter : 0
          if (self.retryAfter <= 0 && self.backoffTimer) {
            clearInterval(self.backoffTimer)
            self.backoffTimer = null
          }
        }, 1000)
      }
    },
    doUnlock: function () {
      this.errorMsg = ''
      if (!this.password) { this.errorMsg = '请输入主密码'; return }
      this.loading = true
      try {
        authService.unlock(this.password)
        this.password = ''
        i18n.setLanguage((vaultService.getCategories() && uni.getStorageSync('pv.lang')) || 'zh-CN')
        uni.switchTab({ url: '/pages/vault/vault' })
      } catch (e) {
        const err = normalizeError(e)
        this.errorMsg = err.code === ERROR_CODES.CRYPTO_AUTH ? this.t('wrongPassword') : err.message
        this.password = ''
        this.refreshBackoff()
      } finally {
        this.loading = false
      }
    },
    doBiometric: function () {
      const self = this
      this.errorMsg = ''
      biometric.authenticate({ reason: '验证以解锁密码库', challenge: 'pv-unlock' }).then(function (res) {
        if (!res.success) {
          self.errorMsg = '生物识别未通过，请使用主密码'
          return
        }
        // 生物识别仅作门禁：底层仍需主密码派生密钥，故回退到主密码输入。
        self.errorMsg = '请使用主密码完成解锁（生物识别仅作快速验证）'
      })
    }
  }
}
</script>

<style scoped>
.unlock-page { min-height: 100vh; background: linear-gradient(160deg, #3a6ff8 0%, #6f9bff 40%, #f5f6fa 40%); padding: 120rpx 48rpx 48rpx; }
.brand { text-align: center; color: #fff; margin-bottom: 80rpx; }
.brand-icon { font-size: 100rpx; }
.brand-name { font-size: 44rpx; font-weight: bold; margin-top: 20rpx; }
.brand-slogan { font-size: 24rpx; opacity: 0.85; margin-top: 12rpx; }
.panel { background: #fff; border-radius: 24rpx; padding: 48rpx 40rpx; box-shadow: 0 12rpx 40rpx rgba(0,0,0,0.1); }
.label { font-size: 28rpx; color: #606266; margin-bottom: 20rpx; }
.primary-btn { background: #3a6ff8; color: #fff; font-size: 32rpx; border-radius: 12rpx; height: 88rpx; line-height: 88rpx; margin-top: 32rpx; }
.ghost-btn { background: #fff; color: #3a6ff8; border: 1rpx solid #3a6ff8; font-size: 28rpx; border-radius: 12rpx; height: 80rpx; line-height: 80rpx; margin-top: 20rpx; }
.error { color: #f56c6c; font-size: 26rpx; margin-top: 24rpx; text-align: center; }
.backoff { color: #e6a23c; font-size: 26rpx; margin-top: 16rpx; text-align: center; }
.tip { color: #c0c4cc; font-size: 22rpx; margin-top: 40rpx; text-align: center; line-height: 1.5; }
</style>
