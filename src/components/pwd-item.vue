<template>
  <view class="entry-card" @tap="onOpen">
    <view class="entry-left">
      <view class="entry-badge" :style="{ background: color }">{{ initial }}</view>
      <view class="entry-info">
        <text class="entry-site">{{ entry.site }}</text>
        <text class="entry-account">{{ entry.account || '—' }}</text>
      </view>
    </view>
    <view class="entry-actions">
      <text class="action-copy" @tap.stop="onCopy">复制</text>
      <text class="action-arrow">›</text>
    </view>
  </view>
</template>

<script>
/**
 * 条目卡片：网站名/账号明文渲染，密码仅掩码显示，复制走剪贴板 TTL 策略。
 */
export default {
  name: 'PwdItem',
  props: {
    entry: { type: Object, required: true }
  },
  computed: {
    initial: function () {
      const s = String((this.entry && this.entry.site) || '').trim()
      return s ? s.charAt(0).toUpperCase() : '#'
    },
    color: function () {
      const palette = ['#3A6FF8', '#22A06B', '#E6A23C', '#8E6CE4', '#F56C6C', '#00A6A6']
      const s = String((this.entry && this.entry.site) || '')
      let sum = 0
      for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i)
      return palette[sum % palette.length]
    }
  },
  methods: {
    onOpen: function () { this.$emit('open', this.entry.id) },
    onCopy: function () { this.$emit('copy', this.entry) }
  }
}
</script>

<style scoped>
.entry-card { display: flex; align-items: center; justify-content: space-between; padding: 24rpx; background: #fff; border-radius: 16rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.entry-left { display: flex; align-items: center; flex: 1; min-width: 0; }
.entry-badge { width: 80rpx; height: 80rpx; border-radius: 20rpx; color: #fff; font-size: 36rpx; font-weight: bold; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; flex-shrink: 0; }
.entry-info { display: flex; flex-direction: column; min-width: 0; }
.entry-site { font-size: 30rpx; color: #303133; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry-account { font-size: 24rpx; color: #909399; margin-top: 8rpx; }
.entry-actions { display: flex; align-items: center; }
.action-copy { color: #3a6ff8; font-size: 26rpx; padding: 10rpx 20rpx; }
.action-arrow { color: #c0c4cc; font-size: 40rpx; margin-left: 10rpx; }
</style>
