<template>
  <view class="manage-page">
    <view class="add-row">
      <input class="input" v-model="newName" placeholder="新分类名称" />
      <view class="add-btn" @tap="add">添加</view>
    </view>
    <view class="list">
      <view v-for="c in list" :key="c.id" class="item">
        <view class="dot" :style="{ background: c.color }"></view>
        <text class="name">{{ c.name }}</text>
        <text v-if="c.builtin" class="builtin">内置</text>
        <text v-else class="del" @tap="remove(c.id)">删除</text>
      </view>
      <empty-state v-if="!list.length" text="暂无分类" />
    </view>
  </view>
</template>

<script>
import categoryService from '../../services/category-service.js'
import { normalizeError } from '../../utils/constants.js'
import EmptyState from '../../components/empty-state.vue'

export default {
  name: 'CategoryPage',
  components: { EmptyState },
  data: function () { return { list: [], newName: '' } },
  onShow: function () { this.reload() },
  methods: {
    reload: function () { this.list = categoryService.list() },
    add: function () {
      if (!this.newName.trim()) return
      try {
        categoryService.create({ name: this.newName })
        this.newName = ''
        this.reload()
      } catch (e) { uni.showToast({ title: normalizeError(e).message, icon: 'none' }) }
    },
    remove: function (id) {
      try { categoryService.remove(id); this.reload() } catch (e) { uni.showToast({ title: normalizeError(e).message, icon: 'none' }) }
    }
  }
}
</script>

<style scoped>
.manage-page { min-height: 100vh; background: #f5f6fa; padding: 32rpx; }
.add-row { display: flex; margin-bottom: 24rpx; }
.input { flex: 1; background: #fff; border-radius: 12rpx; padding: 18rpx 24rpx; font-size: 28rpx; }
.add-btn { background: #3a6ff8; color: #fff; font-size: 26rpx; padding: 0 32rpx; margin-left: 16rpx; border-radius: 12rpx; display: flex; align-items: center; }
.list { background: #fff; border-radius: 24rpx; padding: 16rpx 32rpx; }
.item { display: flex; align-items: center; padding: 24rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.dot { width: 28rpx; height: 28rpx; border-radius: 50%; margin-right: 20rpx; }
.name { flex: 1; font-size: 30rpx; color: #303133; }
.builtin { font-size: 22rpx; color: #c0c4cc; }
.del { font-size: 24rpx; color: #f56c6c; }
</style>
