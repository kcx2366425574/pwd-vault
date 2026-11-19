<template>
  <view class="strength">
    <view class="strength-bars">
      <view v-for="i in 5" :key="i" class="bar" :style="{ background: barColor(i) }"></view>
    </view>
    <text class="strength-label" :style="{ color: labelColor }">{{ label }}</text>
  </view>
</template>

<script>
/**
 * 密码强度指示器（纯 UI 估算，非安全承诺）。
 */
import generatorService from '../services/generator-service.js'

export default {
  name: 'StrengthMeter',
  props: { password: { type: String, default: '' } },
  computed: {
    score: function () { return generatorService.strength(this.password) },
    level: function () { return Math.max(0, Math.min(5, Math.ceil(this.score / 20))) },
    label: function () {
      const names = ['很弱', '弱', '一般', '较强', '强', '很强']
      return names[this.level] || '很弱'
    },
    labelColor: function () {
      const colors = ['#f56c6c', '#f56c6c', '#e6a23c', '#409eff', '#22a06b', '#22a06b']
      return colors[this.level] || '#f56c6c'
    }
  },
  methods: {
    barColor: function (i) {
      return i <= this.level ? this.labelColor : '#e4e7ed'
    }
  }
}
</script>

<style scoped>
.strength { display: flex; align-items: center; }
.strength-bars { display: flex; flex: 1; }
.bar { flex: 1; height: 8rpx; margin-right: 6rpx; border-radius: 4rpx; transition: background 0.2s; }
.strength-label { font-size: 24rpx; margin-left: 16rpx; width: 80rpx; text-align: right; }
</style>
