<template>
  <view class="filter-bar">
    <input class="search" v-model="keyword" placeholder="搜索网站或账号" @input="onChange" />
    <scroll-view scroll-x class="chips" v-if="categories.length || tags.length">
      <text class="chip" :class="{ active: categoryId === '' }" @tap="pickCategory('')">全部</text>
      <text v-for="c in categories" :key="c.id" class="chip" :class="{ active: categoryId === c.id }" @tap="pickCategory(c.id)">{{ c.name }}</text>
    </scroll-view>
  </view>
</template>

<script>
/**
 * 搜索 + 分类/标签筛选栏。筛选在内存明文进行。
 */
import { EVENTS } from '../utils/constants.js'
import eventBus from '../utils/event-bus.js'

export default {
  name: 'FilterBar',
  props: {
    categories: { type: Array, default: function () { return [] } },
    tags: { type: Array, default: function () { return [] } }
  },
  data: function () {
    return { keyword: '', categoryId: '', tagId: '' }
  },
  methods: {
    onChange: function () { this.emitChange() },
    pickCategory: function (id) { this.categoryId = id; this.emitChange() },
    pickTag: function (id) { this.tagId = id; this.emitChange() },
    emitChange: function () {
      this.$emit('change', { keyword: this.keyword, categoryId: this.categoryId, tagId: this.tagId })
    }
  }
}
</script>

<style scoped>
.filter-bar { padding: 20rpx; }
.search { height: 76rpx; background: #fff; border-radius: 12rpx; padding: 0 24rpx; font-size: 28rpx; }
.chips { display: flex; margin-top: 20rpx; white-space: nowrap; }
.chip { display: inline-block; font-size: 24rpx; padding: 10rpx 24rpx; background: #fff; color: #606266; border-radius: 999rpx; margin-right: 14rpx; }
.chip.active { background: #3a6ff8; color: #fff; }
</style>
