<template>
  <view class="vault-page">
    <view class="topbar">
      <view class="topbar-title">我的密码</view>
      <view class="topbar-actions">
        <text class="icon-btn" @tap="goGenerator">⚙</text>
      </view>
    </view>

    <view class="search-row">
      <input class="search" v-model="keyword" placeholder="搜索网站或账号" @input="onSearch" />
      <view class="add-btn" @tap="goAdd">+ 新增</view>
    </view>

    <scroll-view scroll-x class="filter-row" v-if="categories.length">
      <text class="chip" :class="{ active: !categoryId }" @tap="pickCat('')">全部</text>
      <text v-for="c in categories" :key="c.id" class="chip" :class="{ active: categoryId === c.id }" @tap="pickCat(c.id)">{{ c.name }}</text>
    </scroll-view>

    <scroll-view scroll-y class="list">
      <pwd-item
        v-for="e in visibleList"
        :key="e.id"
        :entry="e"
        @open="goDetail"
        @copy="copyPassword"
      />
      <empty-state v-if="!visibleList.length" :text="keyword ? '没有匹配的条目' : '还没有保存的密码'" actionText="新增第一条" @action="goAdd" />
    </scroll-view>

    <clipboard-countdown ref="countdown" />
  </view>
</template>

<script>
/**
 * 密码库主页：列表、搜索、分类筛选、新增入口、复制密码（TTL 清空）。
 */
import entryService from '../../services/entry-service.js'
import vaultService from '../../services/vault-service.js'
import authService from '../../services/auth-service.js'
import clipboard from '../../utils/clipboard.js'
import { EVENTS } from '../../utils/constants.js'
import eventBus from '../../utils/event-bus.js'
import PwdItem from '../../components/pwd-item.vue'
import EmptyState from '../../components/empty-state.vue'
import ClipboardCountdown from '../../components/clipboard-countdown.vue'

export default {
  name: 'VaultPage',
  components: { PwdItem, EmptyState, ClipboardCountdown },
  data: function () {
    return { keyword: '', categoryId: '', list: [], categories: [] }
  },
  computed: {
    visibleList: function () {
      const self = this
      let arr = this.list.slice()
      if (self.keyword) {
        const kw = self.keyword.toLowerCase()
        arr = arr.filter(function (e) {
          return [e.site, e.account, e.url, e.note].some(function (v) { return String(v || '').toLowerCase().indexOf(kw) !== -1 })
        })
      }
      if (self.categoryId) {
        arr = arr.filter(function (e) { return e.categoryId === self.categoryId })
      }
      return arr
    }
  },
  onLoad: function () {
    const self = this
    this._onChanged = function () { self.reload() }
    eventBus.on(EVENTS.VAULT_CHANGED, this._onChanged)
  },
  onShow: function () {
    // 未解锁则回到解锁页
    if (!authService.isUnlocked()) {
      uni.reLaunch({ url: '/pages/index/index' })
      return
    }
    this.reload()
    this.syncLang()
  },
  onUnload: function () {
    eventBus.off(EVENTS.VAULT_CHANGED, this._onChanged)
  },
  methods: {
    reload: function () {
      this.list = entryService.listAll()
      this.categories = vaultService.getCategories().slice()
    },
    syncLang: function () {
      const lang = uni.getStorageSync('pv.lang')
      try { uni.setNavigationBarTitle({ title: '我的密码' }) } catch (e) { /* 忽略 */ }
    },
    onSearch: function (e) { this.keyword = e.detail.value },
    pickCat: function (id) { this.categoryId = id },
    goAdd: function () { uni.navigateTo({ url: '/pages/detail/detail' }) },
    goDetail: function (id) { uni.navigateTo({ url: '/pages/detail/detail?id=' + id }) },
    goGenerator: function () { uni.navigateTo({ url: '/pages/generator/generator' }) },
    copyPassword: function (entry) {
      entryService.touch(entry.id)
      clipboard.copy(entry.password)
      if (this.$refs.countdown) this.$refs.countdown.start(30)
      uni.showToast({ title: '已复制', icon: 'success' })
    }
  }
}
</script>

<style scoped>
.vault-page { min-height: 100vh; background: #f5f6fa; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 28rpx 32rpx 16rpx; }
.topbar-title { font-size: 40rpx; font-weight: bold; color: #303133; }
.icon-btn { font-size: 40rpx; color: #606266; }
.search-row { display: flex; padding: 12rpx 32rpx; }
.search { flex: 1; height: 76rpx; background: #fff; border-radius: 12rpx; padding: 0 24rpx; font-size: 28rpx; }
.add-btn { background: #3a6ff8; color: #fff; font-size: 26rpx; padding: 0 28rpx; margin-left: 16rpx; border-radius: 12rpx; display: flex; align-items: center; }
.filter-row { padding: 12rpx 32rpx; white-space: nowrap; }
.chip { display: inline-block; font-size: 24rpx; padding: 10rpx 24rpx; background: #fff; color: #606266; border-radius: 999rpx; margin-right: 14rpx; }
.chip.active { background: #3a6ff8; color: #fff; }
.list { padding: 12rpx 32rpx 40rpx; height: calc(100vh - 320rpx); }
</style>
