<template>
  <view class="health-page">
    <view class="score-card">
      <view class="score">{{ report.score }}</view>
      <view class="score-label">安全评分</view>
      <view class="score-desc">{{ scoreDesc }}</view>
    </view>

    <view class="card">
      <view class="card-title">弱密码 <text class="count">{{ report.weak.length }}</text></view>
      <view v-for="(w, i) in report.weak" :key="'w'+i" class="issue">{{ w.site }} · 强度 {{ w.score }}（{{ w.reason }}）</view>
      <view v-if="!report.weak.length" class="ok">✓ 未发现弱密码</view>
    </view>

    <view class="card">
      <view class="card-title">重复密码 <text class="count">{{ report.reused.length }}</text></view>
      <view v-for="(r, i) in report.reused" :key="'r'+i" class="issue">{{ r.sites.join('、') }} 使用了相同密码</view>
      <view v-if="!report.reused.length" class="ok">✓ 未发现重复密码</view>
    </view>

    <view class="card">
      <view class="card-title">长期未更新 <text class="count">{{ report.stale.length }}</text></view>
      <view v-for="(s, i) in report.stale" :key="'s'+i" class="issue">{{ s.site }} · 已 {{ s.days }} 天未更新</view>
      <view v-if="!report.stale.length" class="ok">✓ 未发现陈旧密码</view>
    </view>

    <view class="note">共检查 {{ report.total }} 条密码。体检仅在本地内存进行，结果不落盘、不上传。</view>
  </view>
</template>

<script>
import healthService from '../../services/health-service.js'

export default {
  name: 'HealthPage',
  data: function () {
    return { report: { score: 100, weak: [], reused: [], stale: [], total: 0 } }
  },
  computed: {
    scoreDesc: function () {
      const s = this.report.score
      if (s >= 90) return '很好，继续保持'
      if (s >= 70) return '良好，仍有改进空间'
      if (s >= 50) return '一般，建议尽快改进'
      return '较差，请立即处理上述问题'
    }
  },
  onShow: function () { this.report = healthService.audit(180) }
}
</script>

<style scoped>
.health-page { min-height: 100vh; background: #f5f6fa; padding: 32rpx; }
.score-card { background: linear-gradient(135deg, #3a6ff8, #6f9bff); border-radius: 24rpx; padding: 48rpx; text-align: center; color: #fff; margin-bottom: 24rpx; }
.score { font-size: 100rpx; font-weight: bold; line-height: 1; }
.score-label { font-size: 26rpx; opacity: 0.9; margin-top: 12rpx; }
.score-desc { font-size: 24rpx; opacity: 0.85; margin-top: 16rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx; }
.card-title { font-size: 30rpx; color: #303133; font-weight: bold; margin-bottom: 20rpx; }
.count { background: #f56c6c; color: #fff; font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; margin-left: 10rpx; }
.issue { font-size: 26rpx; color: #e6a23c; padding: 10rpx 0; line-height: 1.5; }
.ok { font-size: 26rpx; color: #22a06b; }
.note { font-size: 22rpx; color: #c0c4cc; text-align: center; margin-top: 24rpx; line-height: 1.6; }
</style>
