<template>
  <view class="setup-page">
    <view class="header">
      <view class="title">设置主密码</view>
      <view class="subtitle">主密码用于加密本地数据，请务必牢记</view>
    </view>

    <view class="form">
      <view class="label">主密码</view>
      <pwd-input v-model="pwd" placeholder="至少 8 位，建议含大小写/数字/符号" />
      <strength-meter :password="pwd" />

      <view class="label gap">确认主密码</view>
      <pwd-input v-model="pwd2" placeholder="请再次输入主密码" />

      <view class="warning">
        <text class="warn-icon">⚠️</text>
        <text>忘记主密码将无法找回，加密数据不可恢复。请妥善保管。</text>
      </view>
      <view class="agree" @tap="agreed = !agreed">
        <text class="checkbox">{{ agreed ? '☑' : '☐' }}</text>
        <text>我已理解并接受上述风险</text>
      </view>

      <button class="primary-btn" :loading="loading" :disabled="!agreed" @tap="doSetup">完成设置</button>
      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>
    </view>
  </view>
</template>

<script>
/**
 * 首次设置主密码页。CSPRNG 自检由 authService 内部完成。
 */
import authService from '../../services/auth-service.js'
import i18n from '../../utils/i18n.js'
import { normalizeError, LANGUAGES } from '../../utils/constants.js'
import PwdInput from '../../components/pwd-input.vue'
import StrengthMeter from '../../components/strength-meter.vue'

export default {
  name: 'SetupPage',
  components: { PwdInput, StrengthMeter },
  data: function () {
    return { pwd: '', pwd2: '', agreed: false, loading: false, errorMsg: '' }
  },
  methods: {
    doSetup: function () {
      this.errorMsg = ''
      if (!this.agreed) { this.errorMsg = '请先确认风险提示'; return }
      if (this.pwd !== this.pwd2) { this.errorMsg = '两次输入的主密码不一致'; return }
      this.loading = true
      try {
        authService.setupMasterPassword(this.pwd)
        i18n.setLanguage(LANGUAGES.ZH_CN)
        uni.setStorageSync('pv.lang', LANGUAGES.ZH_CN)
        this.pwd = ''
        this.pwd2 = ''
        uni.reLaunch({ url: '/pages/vault/vault' })
      } catch (e) {
        this.errorMsg = normalizeError(e).message
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.setup-page { min-height: 100vh; background: #f5f6fa; padding: 48rpx 40rpx; }
.header { margin-bottom: 40rpx; }
.title { font-size: 44rpx; font-weight: bold; color: #303133; }
.subtitle { font-size: 26rpx; color: #909399; margin-top: 12rpx; }
.form { background: #fff; border-radius: 24rpx; padding: 40rpx; }
.label { font-size: 28rpx; color: #606266; margin-bottom: 16rpx; }
.gap { margin-top: 36rpx; }
.warning { display: flex; align-items: flex-start; background: #fef0f0; color: #f56c6c; font-size: 24rpx; line-height: 1.6; padding: 24rpx; border-radius: 12rpx; margin-top: 36rpx; }
.warn-icon { margin-right: 12rpx; }
.agree { display: flex; align-items: center; font-size: 26rpx; color: #606266; margin-top: 28rpx; }
.checkbox { font-size: 36rpx; color: #3a6ff8; margin-right: 12rpx; }
.primary-btn { background: #3a6ff8; color: #fff; font-size: 32rpx; border-radius: 12rpx; height: 88rpx; line-height: 88rpx; margin-top: 40rpx; }
.primary-btn[disabled] { background: #c0c4cc; }
.error { color: #f56c6c; font-size: 26rpx; margin-top: 20rpx; text-align: center; }
</style>
