/**
 * 本地/文件同步占位实现（默认 SyncProvider）。
 *
 * 用途：在云同步后端（uniCloud / 自建 / BaaS）尚未确定前，提供可运行的默认实现，
 * 让同步 UI 与冲突合并逻辑可以完整测试。数据以密文形式存到本地独立 storage 键，
 * 模拟「远端副本」，服务端零知识。替换为真实后端时只需实现同接口。
 */
import { STORAGE_KEYS, ERROR_CODES, createError } from '../utils/constants.js'

const REMOTE_KEY = 'pv.sync.remote'
const META_KEY = 'pv.sync.meta'

const localProvider = {
  isConfigured: function isConfigured() { return true },

  login: function login(account, credential) {
    if (!String(account || '').trim() || !String(credential || '')) {
      return Promise.reject(createError(ERROR_CODES.VALIDATION, '账号或凭证不能为空'))
    }
    try {
      uni.setStorageSync(META_KEY, JSON.stringify({ account: String(account), local: true, loggedInAt: Date.now() }))
      return Promise.resolve({ userId: 'local', token: 'local-token' })
    } catch (e) {
      return Promise.reject(createError(ERROR_CODES.STORAGE_WRITE, '本地同步初始化失败'))
    }
  },

  logout: function logout() {
    try { uni.removeStorageSync(META_KEY) } catch (e) { /* 静默 */ }
  },

  upload: function upload(vaultCipher, meta) {
    try {
      const syncedAt = Date.now()
      uni.setStorageSync(REMOTE_KEY, JSON.stringify({
        vaultCipher: vaultCipher,
        meta: Object.assign({}, meta || {}, { syncedAt: syncedAt })
      }))
      return Promise.resolve({ ok: true, syncedAt: syncedAt })
    } catch (e) {
      return Promise.reject(createError(ERROR_CODES.STORAGE_WRITE, '上传失败'))
    }
  },

  download: function download(since) {
    try {
      const raw = uni.getStorageSync(REMOTE_KEY)
      if (!raw) return Promise.resolve([])
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!parsed || !parsed.vaultCipher) return Promise.resolve([])
      if (since && parsed.meta && parsed.meta.syncedAt && parsed.meta.syncedAt <= Number(since)) {
        return Promise.resolve([])
      }
      return Promise.resolve([{ vaultCipher: parsed.vaultCipher, meta: parsed.meta || {} }])
    } catch (e) {
      return Promise.reject(createError(ERROR_CODES.CRYPTO_FORMAT, '读取远端副本失败'))
    }
  },

  getStatus: function getStatus() {
    let loggedIn = false
    try { loggedIn = !!uni.getStorageSync(META_KEY) } catch (e) { /* 静默 */ }
    return { online: loggedIn, lastSyncAt: 0, local: true }
  }
}

export default localProvider
