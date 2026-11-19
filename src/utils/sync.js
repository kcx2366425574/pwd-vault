/**
 * 同步模块抽象入口：统一导出当前 SyncProvider 与同步服务。
 * 业务层只依赖此文件，切换后端不影响上层。
 */
import localProvider from '../providers/sync-local.js'
import syncService from '../services/sync-service.js'

const sync = {
  provider: localProvider,
  service: syncService,
  /** 替换后端实现（实现 SyncProvider 接口） */
  use: function use(provider) {
    if (provider) {
      sync.provider = provider
      syncService.setProvider(provider)
    }
  }
}

export default sync
