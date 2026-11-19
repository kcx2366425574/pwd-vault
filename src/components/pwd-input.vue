<template>
  <view class="pwd-input-wrap">
    <input
      class="pwd-input"
      :type="show ? 'text' : 'password'"
      :value="modelValue !== undefined && modelValue !== null ? modelValue : value"
      :placeholder="placeholder"
      :maxlength="maxlength"
      @input="onInput"
    />
    <text class="pwd-toggle" @tap="toggle">{{ show ? '隐藏' : '显示' }}</text>
  </view>
</template>

<script>
/**
 * 密码输入框：默认掩码，支持显示/隐藏切换。不打印、不缓存明文到日志。
 */
export default {
  name: 'PwdInput',
  props: {
    modelValue: { type: String, default: '' },
    value: { type: String, default: '' },
    placeholder: { type: String, default: '请输入密码' },
    maxlength: { type: Number, default: 128 }
  },
  data: function () {
    return { show: false }
  },
  methods: {
    onInput: function (e) {
      const val = e.detail.value
      this.$emit('update:modelValue', val)
      this.$emit('input', val)
    },
    toggle: function () {
      this.show = !this.show
    }
  }
}
</script>

<style scoped>
.pwd-input-wrap { display: flex; align-items: center; border: 1rpx solid #e4e7ed; border-radius: 12rpx; background: #fff; padding: 0 20rpx; }
.pwd-input { flex: 1; height: 88rpx; font-size: 30rpx; color: #303133; }
.pwd-toggle { color: #3a6ff8; font-size: 26rpx; padding-left: 16rpx; flex-shrink: 0; }
</style>
