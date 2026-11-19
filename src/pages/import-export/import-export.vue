<template>
  <view class="io-page">
    <view class="card">
      <view class="card-title">导出加密备份</view>
      <view class="desc">将整个密码库导出为加密文件（.pwdvault），用于迁移与容灾。导出需输入主密码。</view>
      <pwd-input v-model="exportPwd" placeholder="输入主密码以加密备份" />
      <button class="primary-btn" @tap="doExport">导出备份</button>
      <view v-if="exportText" class="result" @tap="copyBackup">备份内容已生成，点此复制保存（{{ exportText.length }} 字符）</view>
    </view>

    <view class="card">
      <view class="card-title">导入加密备份</view>
      <view class="desc">粘贴此前导出的备份内容，输入备份密码，恢复密码库。导入会替换当前库。</view>
      <textarea class="textarea" v-model="importText" placeholder="粘贴备份内容" />
      <pwd-input v-model="importPwd" placeholder="输入备份密码" />
      <button class="danger-btn" @tap="doImport">导入并替换</button>
    </view>
  </view>
</template>

<script>
/**
 * 加密导入导出页。备份文件格式 PVBACKUP1，端到端加密。
 */
import backupService from '../../services/backup-service.js'
import clipboard from '../../utils/clipboard.js'
import { normalizeError } from '../../utils/constants.js'
import PwdInput from '../../components/pwd-input.vue'

export default {
  name: 'ImportExportPage',
  components: { PwdInput },
  data: function () {
    return { exportPwd: '', exportText: '', importPwd: '', importText: '' }
  },
  methods: {
    doExport: function () {
      try {
        this.exportText = backupService.exportEncrypted(this.exportPwd)
        this.exportPwd = ''
        uni.showToast({ title: '备份已生成', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: normalizeError(e).message, icon: 'none' })
      }
    },
    copyBackup: function () {
      clipboard.copy(this.exportText)
      uni.showToast({ title: '已复制到剪贴板', icon: 'success' })
    },
    doImport: function () {
      const self = this
      uni.showModal({
        title: '确认导入',
        content: '导入将替换当前密码库，此操作不可撤销。确定继续？',
        success: function (r) {
          if (!r.confirm) return
          try {
            backupService.importEncrypted(self.importText, self.importPwd)
            self.importText = ''
            self.importPwd = ''
            uni.showToast({ title: '导入成功', icon: 'success' })
            setTimeout(function () { uni.switchTab({ url: '/pages/vault/vault' }) }, 500)
          } catch (e) {
            uni.showToast({ title: normalizeError(e).message, icon: 'none' })
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.io-page { min-height: 100vh; background: #f5f6fa; padding: 32rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx; }
.card-title { font-size: 32rpx; font-weight: bold; color: #303133; margin-bottom: 16rpx; }
.desc { font-size: 24rpx; color: #909399; line-height: 1.6; margin-bottom: 24rpx; }
.textarea { width: 100%; height: 180rpx; background: #f8f8f9; border-radius: 12rpx; padding: 20rpx; font-size: 24rpx; box-sizing: border-box; margin-bottom: 20rpx; }
.primary-btn { background: #3a6ff8; color: #fff; font-size: 30rpx; border-radius: 12rpx; height: 84rpx; line-height: 84rpx; margin-top: 20rpx; }
.danger-btn { background: #f56c6c; color: #fff; font-size: 30rpx; border-radius: 12rpx; height: 84rpx; line-height: 84rpx; margin-top: 20rpx; }
.result { background: #ecf5ff; color: #3a6ff8; font-size: 24rpx; padding: 20rpx; border-radius: 12rpx; margin-top: 20rpx; text-align: center; }
</style>
