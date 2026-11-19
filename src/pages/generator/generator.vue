<template>
  <view class="gen-page">
    <view class="card">
      <view class="row">
        <text class="label">密码长度</text>
        <text class="value">{{ length }}</text>
      </view>
      <slider :value="length" min="8" max="64" @change="onLength" activeColor="#3a6ff8" />

      <view class="row"><text class="label">包含大写字母 (A-Z)</text><switch :checked="upper" @change="upper = $event.detail.value" color="#3a6ff8" /></view>
      <view class="row"><text class="label">包含小写字母 (a-z)</text><switch :checked="lower" @change="lower = $event.detail.value" color="#3a6ff8" /></view>
      <view class="row"><text class="label">包含数字 (0-9)</text><switch :checked="digits" @change="digits = $event.detail.value" color="#3a6ff8" /></view>
      <view class="row"><text class="label">包含符号 (!@#...)</text><switch :checked="symbols" @change="symbols = $event.detail.value" color="#3a6ff8" /></view>
      <view class="row"><text class="label">排除易混淆字符</text><switch :checked="excludeAmbiguous" @change="excludeAmbiguous = $event.detail.value" color="#3a6ff8" /></view>
    </view>

    <view class="card result-card">
      <view class="result">{{ password || '点击下方按钮生成' }}</view>
      <strength-meter :password="password" />
    </view>

    <button class="primary-btn" @tap="generate">🔄 生成强密码</button>
    <button class="copy-btn" @tap="copy">复制到剪贴板（30s 后清空）</button>
    <clipboard-countdown ref="countdown" />
  </view>
</template>

<script>
/**
 * 强密码生成器页面。唯一随机源为 CsprngAdapter。
 */
import generatorService from '../../services/generator-service.js'
import clipboard from '../../utils/clipboard.js'
import { GENERATOR_DEFAULTS, normalizeError } from '../../utils/constants.js'
import StrengthMeter from '../../components/strength-meter.vue'
import ClipboardCountdown from '../../components/clipboard-countdown.vue'

export default {
  name: 'GeneratorPage',
  components: { StrengthMeter, ClipboardCountdown },
  data: function () {
    return {
      length: GENERATOR_DEFAULTS.LENGTH,
      upper: GENERATOR_DEFAULTS.UPPER,
      lower: GENERATOR_DEFAULTS.LOWER,
      digits: GENERATOR_DEFAULTS.DIGITS,
      symbols: GENERATOR_DEFAULTS.SYMBOLS,
      excludeAmbiguous: GENERATOR_DEFAULTS.EXCLUDE_AMBIGUOUS,
      password: ''
    }
  },
  methods: {
    onLength: function (e) { this.length = Number(e.detail.value) },
    generate: function () {
      try {
        this.password = generatorService.generate({
          length: this.length, upper: this.upper, lower: this.lower,
          digits: this.digits, symbols: this.symbols, excludeAmbiguous: this.excludeAmbiguous
        })
      } catch (e) {
        uni.showToast({ title: normalizeError(e).message, icon: 'none' })
      }
    },
    copy: function () {
      if (!this.password) { uni.showToast({ title: '请先生成密码', icon: 'none' }); return }
      clipboard.copy(this.password)
      if (this.$refs.countdown) this.$refs.countdown.start(30)
      uni.showToast({ title: '已复制', icon: 'success' })
    }
  }
}
</script>

<style scoped>
.gen-page { min-height: 100vh; background: #f5f6fa; padding: 32rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx; }
.row { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 0; }
.label { font-size: 28rpx; color: #606266; }
.value { font-size: 32rpx; color: #3a6ff8; font-weight: bold; }
.result-card { text-align: center; }
.result { font-size: 36rpx; color: #303133; letter-spacing: 2rpx; word-break: break-all; margin-bottom: 28rpx; line-height: 1.5; }
.primary-btn { background: #3a6ff8; color: #fff; font-size: 32rpx; border-radius: 12rpx; height: 88rpx; line-height: 88rpx; }
.copy-btn { background: #fff; color: #3a6ff8; border: 1rpx solid #3a6ff8; font-size: 30rpx; border-radius: 12rpx; height: 84rpx; line-height: 84rpx; margin-top: 20rpx; }
</style>
