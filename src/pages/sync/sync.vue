<template>
  <view class="sync-page">
    <view class="card">
      <view class="status-row">
        <text class="status-dot" :class="status.status"></text>
        <text class="status-text">{{ statusText }}</text>
      </view>
      <view class="info" v-if="status.lastSyncAt">上次同步：{{ lastSyncText }}</view>
      <view class="info">同步模式：本地占位（端到端加密，仅密文）</view>
    </view>

    <view class="card">
      <view class="label">同步账号（可选，用于接入真实后端）</view>
      <input class="input" v-model="account" placeholder="账号 / 邮箱" />
      <input class="input pwd" v-model="credential" type="password" placeholder="凭证 / 口令" />
      <button class="primary-btn" :loading="syncing" @tap="doSync">立即同步</button>
    </view>

    <view class="card" v-if="conflicts.length">
      <view class="label">待确认冲突（{{ conflicts.length }}）</view>
      <view v-for="(c, i) in conflicts" :key="i" class="conflict">{{ conflictText(c) }}</view>
      <view class="note">冲突条目已保留双方版本，未静默覆盖。请到密码库核对带「远端副本」标记的条目。</view>
    </view>

    <view class="card notice">
      <view class="label">关于云同步</view>
      <view class="note">当前版本为本地/文件占位实现，完整演示端到端加密与冲突合并流程。真实后端（uniCloud / 自建 / BaaS）待选定后，只需替换 SyncProvider 实现，业务层无需改动。全程只传密文，服务端无密钥。</view>
    </view>
  </view>
</template>

<script>
import syncService from '../../services/sync-service.js'
import vaultService from '../../services/vault-service.js'
import { EVENTS as EV, normalizeError } from '../../utils/constants.js'
import eventBus from '../../utils/event-bus.js'

export default {
  name: 'SyncPage',
  data: function () {
    return { account: '', credential: '', syncing: false, status: { status: 'idle', message: '', lastSyncAt: 0 }, conflicts: [] }
  },
  computed: {
    statusText: function () {
      const map = { idle: '未同步', syncing: '同步中', success: '同步完成', error: '同步失败', conflict: '存在冲突待确认' }
      return map[this.status.status] || '未同步'
    },
    lastSyncText: function () {
      const ts = this.status.lastSyncAt
      if (!ts) return ''
      const d = new Date(ts)
      return d.toLocaleString('zh-CN')
    }
  },
  onShow: function () {
    const self = this
    this._onStatus = function (s) {
      self.status.status = s.status
      self.status.message = s.message || ''
    }
    eventBus.on(EV.SYNC_STATUS, this._onStatus)
    const st = syncService.status()
    this.status.lastSyncAt = vaultService.getMeta().lastSyncAt || 0
    this.status.status = st.online ? 'idle' : 'idle'
  },
  onUnload: function () { eventBus.off(EV.SYNC_STATUS, this._onStatus) },
  methods: {
    doSync: function () {
      const self = this
      this.syncing = true
      const cred = (this.account && this.credential) ? { account: this.account, credential: this.credential } : null
      syncService.sync(cred).then(function (r) {
        self.conflicts = r.conflicts || []
        self.status.lastSyncAt = r.syncedAt
        self.syncing = false
        uni.showToast({ title: '同步完成', icon: 'success' })
      }).catch(function (e) {
        self.syncing = false
        uni.showToast({ title: normalizeError(e).message, icon: 'none' })
      })
    },
    conflictText: function (c) {
      if (c.type === 'conflict') return '条目 ' + c.id + '：本地与远端均有修改，已保留双方版本'
      return '远端新增条目：' + c.id
    }
  }
}
</script>

<style scoped>
.sync-page { min-height: 100vh; background: #f5f6fa; padding: 32rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx; }
.status-row { display: flex; align-items: center; }
.status-dot { width: 20rpx; height: 20rpx; border-radius: 50%; background: #c0c4cc; margin-right: 16rpx; }
.status-dot.success { background: #22a06b; }
.status-dot.conflict, .status-dot.error { background: #e6a23c; }
.status-dot.syncing { background: #3a6ff8; }
.status-text { font-size: 32rpx; color: #303133; font-weight: bold; }
.info { font-size: 24rpx; color: #909399; margin-top: 16rpx; line-height: 1.6; }
.label { font-size: 28rpx; color: #606266; margin-bottom: 16rpx; }
.input { width: 100%; background: #f8f8f9; border-radius: 12rpx; padding: 18rpx 24rpx; font-size: 28rpx; margin-bottom: 16rpx; box-sizing: border-box; }
.primary-btn { background: #3a6ff8; color: #fff; font-size: 32rpx; border-radius: 12rpx; height: 84rpx; line-height: 84rpx; margin-top: 12rpx; }
.conflict { font-size: 26rpx; color: #e6a23c; padding: 12rpx 0; }
.note { font-size: 24rpx; color: #909399; line-height: 1.7; margin-top: 12rpx; }
</style>
