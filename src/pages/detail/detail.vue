<template>
  <view class="detail-page">
    <view class="form">
      <view class="label">网站名称 <text class="required">*</text></view>
      <input class="input" v-model="form.site" placeholder="例如 github.com" />

      <view class="label">账号</view>
      <input class="input" v-model="form.account" placeholder="登录账号 / 邮箱" />

      <view class="label">密码 <text class="required">*</text></view>
      <pwd-input v-model="form.password" placeholder="输入或生成强密码" />
      <strength-meter :password="form.password" />
      <view class="gen-link" @tap="goGenerator">✨ 使用密码生成器</view>

      <view class="label">网址</view>
      <input class="input" v-model="form.url" placeholder="https://..." />

      <view class="label">分类</view>
      <picker mode="selector" :range="categoryNames" @change="onCategory">
        <view class="picker">{{ categoryNames[categoryIndex] || '未分类' }} ▾</view>
      </picker>

      <view class="label">标签</view>
      <view class="tags">
        <text v-for="t in allTags" :key="t.id" class="tag" :class="{ on: form.tagIds.indexOf(t.id) >= 0 }" @tap="toggleTag(t.id)">{{ t.name }}</text>
        <text v-if="!allTags.length" class="hint">暂无标签，可在标签管理页创建</text>
      </view>

      <view class="label">备注</view>
      <textarea class="textarea" v-model="form.note" placeholder="可选备注" />

      <view class="label">密码更新提醒</view>
      <picker mode="date" @change="onRemindDate">
        <view class="picker">{{ remindText || '不提醒' }} ▾</view>
      </picker>

      <button class="primary-btn" @tap="save">保存</button>
      <button v-if="isEdit" class="danger-btn" @tap="confirmDelete">删除条目</button>
    </view>

    <confirm-dialog
      :visible="showDelete"
      title="删除条目"
      content="确定要删除这条密码吗？删除后可在同步冲突处理中找回。"
      confirmText="删除"
      danger
      @confirm="doDelete"
      @cancel="showDelete = false"
    />
  </view>
</template>

<script>
/**
 * 新增/编辑条目详情页。
 */
import entryService from '../../services/entry-service.js'
import vaultService from '../../services/vault-service.js'
import reminderService from '../../services/reminder-service.js'
import { normalizeError } from '../../utils/constants.js'
import PwdInput from '../../components/pwd-input.vue'
import StrengthMeter from '../../components/strength-meter.vue'
import ConfirmDialog from '../../components/confirm-dialog.vue'

export default {
  name: 'DetailPage',
  components: { PwdInput, StrengthMeter, ConfirmDialog },
  data: function () {
    return {
      id: '',
      isEdit: false,
      form: { site: '', account: '', password: '', url: '', note: '', categoryId: '', tagIds: [], remindAt: 0 },
      categories: [],
      allTags: [],
      showDelete: false
    }
  },
  computed: {
    categoryNames: function () { return ['未分类'].concat(this.categories.map(function (c) { return c.name })) },
    categoryIndex: function () {
      const idx = this.categories.findIndex ? this.categories.findIndex(function (c) { return c.id === this.form.categoryId }.bind(this)) : -1
      return idx < 0 ? 0 : idx + 1
    },
    remindText: function () {
      if (!this.form.remindAt) return ''
      const d = new Date(this.form.remindAt)
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2)
    }
  },
  onLoad: function (options) {
    this.categories = vaultService.getCategories().slice()
    this.allTags = vaultService.getTags().slice()
    if (options && options.id) {
      this.id = options.id
      const e = entryService.get(options.id)
      if (e) {
        this.isEdit = true
        this.form = {
          site: e.site || '', account: e.account || '', password: e.password || '',
          url: e.url || '', note: e.note || '', categoryId: e.categoryId || '',
          tagIds: (e.tagIds || []).slice(), remindAt: e.remindAt || 0
        }
      }
    }
  },
  methods: {
    onCategory: function (e) {
      const i = Number(e.detail.value)
      this.form.categoryId = i > 0 ? this.categories[i - 1].id : ''
    },
    toggleTag: function (id) {
      const list = this.form.tagIds.slice()
      const i = list.indexOf(id)
      if (i >= 0) list.splice(i, 1)
      else list.push(id)
      this.form.tagIds = list
    },
    onRemindDate: function (e) {
      this.form.remindAt = new Date(e.detail.value + 'T00:00:00').getTime()
    },
    goGenerator: function () { uni.navigateTo({ url: '/pages/generator/generator?from=detail' }) },
    save: function () {
      try {
        if (this.isEdit) entryService.update(this.id, this.form)
        else entryService.create(this.form)
        uni.showToast({ title: '已保存', icon: 'success' })
        setTimeout(function () { uni.navigateBack() }, 400)
      } catch (e) {
        uni.showToast({ title: normalizeError(e).message, icon: 'none' })
      }
    },
    confirmDelete: function () { this.showDelete = true },
    doDelete: function () {
      this.showDelete = false
      try {
        entryService.remove(this.id)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(function () { uni.navigateBack() }, 400)
      } catch (e) {
        uni.showToast({ title: normalizeError(e).message, icon: 'none' })
      }
    }
  }
}
</script>

<style scoped>
.detail-page { min-height: 100vh; background: #f5f6fa; padding: 32rpx; }
.form { background: #fff; border-radius: 24rpx; padding: 36rpx; }
.label { font-size: 28rpx; color: #606266; margin: 24rpx 0 14rpx; }
.required { color: #f56c6c; }
.input, .picker, .textarea { width: 100%; background: #f8f8f9; border-radius: 12rpx; padding: 20rpx; font-size: 28rpx; color: #303133; box-sizing: border-box; }
.textarea { height: 140rpx; }
.gen-link { color: #3a6ff8; font-size: 26rpx; margin-top: 16rpx; }
.tags { display: flex; flex-wrap: wrap; }
.tag { font-size: 24rpx; padding: 10rpx 24rpx; background: #f4f4f5; color: #606266; border-radius: 999rpx; margin: 0 14rpx 14rpx 0; }
.tag.on { background: #3a6ff8; color: #fff; }
.hint { font-size: 24rpx; color: #c0c4cc; }
.primary-btn { background: #3a6ff8; color: #fff; font-size: 32rpx; border-radius: 12rpx; height: 88rpx; line-height: 88rpx; margin-top: 40rpx; }
.danger-btn { background: #fff; color: #f56c6c; border: 1rpx solid #f56c6c; font-size: 30rpx; border-radius: 12rpx; height: 84rpx; line-height: 84rpx; margin-top: 24rpx; }
</style>
