<template>
  <view v-if="seconds > 0" class="countdown">已复制，{{ seconds }}s 后自动清空剪贴板</view>
</template>

<script>
/**
 * 剪贴板清空倒计时提示：订阅 clipboard:clear 相关倒计时事件显示剩余秒数。
 * 由页面在服务复制时通过 ref 调用 start() 启动。
 */
import { EVENTS } from '../utils/constants.js'
import eventBus from '../utils/event-bus.js'

export default {
  name: 'ClipboardCountdown',
  data: function () {
    return { seconds: 0, timer: null }
  },
  mounted: function () {
    const self = this
    this._onClear = function () { self.stop() }
    eventBus.on(EVENTS.CLIPBOARD_CLEAR, this._onClear)
  },
  beforeDestroy: function () {
    this.stop()
    eventBus.off(EVENTS.CLIPBOARD_CLEAR, this._onClear)
  },
  methods: {
    start: function (seconds) {
      this.stop()
      this.seconds = Math.max(0, Number(seconds) || 30)
      const self = this
      this.timer = setInterval(function () {
        self.seconds -= 1
        if (self.seconds <= 0) self.stop()
      }, 1000)
    },
    stop: function () {
      if (this.timer) { clearInterval(this.timer); this.timer = null }
      this.seconds = 0
    }
  }
}
</script>

<style scoped>
.countdown { background: #ecf5ff; color: #3a6ff8; font-size: 24rpx; padding: 14rpx 24rpx; border-radius: 12rpx; text-align: center; margin: 16rpx 0; }
</style>
