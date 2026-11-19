<template>
  <view class="empty">
    <view class="empty-icon">🔒</view>
    <text class="empty-text">{{ text }}</text>
    <text v-if="actionText" class="empty-action" @tap="onAction">{{ actionText }}</text>
  </view>
</template>

<script>
export default {
  name: 'EmptyState',
  props: {
    text: { type: String, default: '暂无数据' },
    actionText: { type: String, default: '' }
  },
  methods: {
    onAction: function () { this.$emit('action') }
  }
}
</script>

<style scoped>
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100rpx 0; }
.empty-icon { font-size: 88rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 28rpx; color: #909399; }
.empty-action { font-size: 28rpx; color: #3a6ff8; margin-top: 24rpx; }
</style>
