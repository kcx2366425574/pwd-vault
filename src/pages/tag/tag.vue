<template>
  <view class="manage-page">
    <view class="add-row">
      <input class="input" v-model="newName" placeholder="新标签名称" />
      <view class="add-btn" @tap="add">添加</view>
    </view>
    <view class="chips">
      <view v-for="t in list" :key="t.id" class="chip" :style="{ background: t.color }">
        <text class="chip-name">{{ t.name }}</text>
        <text class="chip-del" @tap="remove(t.id)">×</text>
      </view>
      <empty-state v-if="!list.length" text="暂无标签" />
    </view>
  </view>
</template>

<script>
import tagService from '../../services/tag-service.js'
import { normalizeError } from '../../utils/constants.js'
import EmptyState from '../../components/empty-state.vue'

export default {
  name: 'TagPage',
  components: { EmptyState },
  data: function () { return { list: [], newName: '' } },
  onShow: function () { this.reload() },
  methods: {
    reload: function () { this.list = tagService.list() },
    add: function () {
      if (!this.newName.trim()) return
      try {
        tagService.create({ name: this.newName })
        this.newName = ''
        this.reload()
      } catch (e) { uni.showToast({ title: normalizeError(e).message, icon: 'none' }) }
    },
    remove: function (id) {
      try { tagService.remove(id); this.reload() } catch (e) { uni.showToast({ title: normalizeError(e).message, icon: 'none' }) }
    }
  }
}
</script>

<style scoped>
.manage-page { min-height: 100vh; background: #f5f6fa; padding: 32rpx; }
.add-row { display: flex; margin-bottom: 32rpx; }
.input { flex: 1; background: #fff; border-radius: 12rpx; padding: 18rpx 24rpx; font-size: 28rpx; }
.add-btn { background: #3a6ff8; color: #fff; font-size: 26rpx; padding: 0 32rpx; margin-left: 16rpx; border-radius: 12rpx; display: flex; align-items: center; }
.chips { display: flex; flex-wrap: wrap; background: #fff; border-radius: 24rpx; padding: 32rpx; }
.chip { display: flex; align-items: center; padding: 12rpx 20rpx; border-radius: 999rpx; margin: 0 16rpx 16rpx 0; }
.chip-name { color: #fff; font-size: 26rpx; }
.chip-del { color: #fff; font-size: 30rpx; margin-left: 14rpx; opacity: 0.8; }
</style>
