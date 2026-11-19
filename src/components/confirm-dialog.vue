<template>
  <view v-if="visible" class="mask" @tap="onCancel">
    <view class="dialog" @tap.stop>
      <view class="title">{{ title }}</view>
      <view class="content">{{ content }}</view>
      <view class="actions">
        <button class="btn-cancel" @tap="onCancel">{{ cancelText }}</button>
        <button class="btn-confirm" :class="{ danger: danger }" @tap="onConfirm">{{ confirmText }}</button>
      </view>
    </view>
  </view>
</template>

<script>
/**
 * 危险操作二次确认弹窗。
 */
export default {
  name: 'ConfirmDialog',
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '请确认' },
    content: { type: String, default: '' },
    confirmText: { type: String, default: '确定' },
    cancelText: { type: String, default: '取消' },
    danger: { type: Boolean, default: false }
  },
  methods: {
    onConfirm: function () { this.$emit('confirm') },
    onCancel: function () { this.$emit('cancel') }
  }
}
</script>

<style scoped>
.mask { position: fixed; left: 0; top: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 999; }
.dialog { width: 600rpx; background: #fff; border-radius: 24rpx; padding: 40rpx; }
.title { font-size: 34rpx; font-weight: bold; color: #303133; text-align: center; }
.content { font-size: 28rpx; color: #606266; line-height: 1.6; margin: 30rpx 0; text-align: center; }
.actions { display: flex; }
.actions button { flex: 1; font-size: 28rpx; border-radius: 12rpx; }
.btn-cancel { background: #f4f4f5; color: #606266; border: none; margin-right: 16rpx; }
.btn-confirm { background: #3a6ff8; color: #fff; border: none; }
.btn-confirm.danger { background: #f56c6c; }
</style>
