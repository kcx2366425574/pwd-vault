<template>
  <view class="remind-page">
    <view class="card">
      <view class="card-title">即将到期 / 已到期</view>
      <view v-for="e in dueList" :key="e.id" class="item">
        <view class="item-main">
          <text class="site">{{ e.site }}</text>
          <text class="date">{{ dueText(e.remindAt) }}</text>
        </view>
        <text class="renew" @tap="renew(e.id, 90)">续期 90 天</text>
      </view>
      <empty-state v-if="!dueList.length" text="暂无到期的更新提醒" />
    </view>
    <view class="note">可在条目详情页设置「密码更新提醒」日期。到期条目会显示在此处。</view>
  </view>
</template>

<script>
import reminderService from '../../services/reminder-service.js'
import EmptyState from '../../components/empty-state.vue'

export default {
  name: 'RemindersPage',
  components: { EmptyState },
  data: function () { return { dueList: [] } },
  onShow: function () { this.reload() },
  methods: {
    reload: function () { this.dueList = reminderService.due(30) },
    dueText: function (ts) {
      if (!ts) return ''
      const d = new Date(Number(ts))
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2)
    },
    renew: function (id, days) {
      reminderService.setReminder(id, Date.now() + days * 24 * 60 * 60 * 1000)
      this.reload()
      uni.showToast({ title: '已续期', icon: 'success' })
    }
  }
}
</script>

<style scoped>
.remind-page { min-height: 100vh; background: #f5f6fa; padding: 32rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 32rpx; }
.card-title { font-size: 32rpx; font-weight: bold; color: #303133; margin-bottom: 20rpx; }
.item { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.item-main { display: flex; flex-direction: column; }
.site { font-size: 30rpx; color: #303133; }
.date { font-size: 24rpx; color: #e6a23c; margin-top: 8rpx; }
.renew { font-size: 24rpx; color: #3a6ff8; }
.note { font-size: 22rpx; color: #c0c4cc; margin-top: 24rpx; text-align: center; line-height: 1.6; }
</style>
