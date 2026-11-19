/**
 * 条目服务：账号密码条目的 CRUD、搜索、组合筛选、安全体检数据支撑。
 *
 * 直接操作 VaultService 托管的内存明文集合，变更后由 VaultService.persist() 原子加密落盘。
 */
import { ERROR_CODES, createError } from '../utils/constants.js'
import csprng from '../utils/csprng.js'
import vaultService from './vault-service.js'
import eventBus from '../utils/event-bus.js'
import { EVENTS } from '../utils/constants.js'

/** 必填字段校验 */
function validateEntry(dto) {
  if (!dto || typeof dto !== 'object') {
    throw createError(ERROR_CODES.VALIDATION, '条目数据无效')
  }
  if (!String(dto.site || '').trim()) {
    throw createError(ERROR_CODES.VALIDATION, '网站名称不能为空')
  }
  if (!String(dto.password || '')) {
    throw createError(ERROR_CODES.VALIDATION, '密码不能为空')
  }
}

/** 构造一条新条目的明文对象 */
function buildEntry(dto, existing) {
  const now = Date.now()
  const base = existing || {}
  return {
    id: base.id || csprng.randomId(),
    site: String(dto.site || '').trim(),
    account: String(dto.account || ''),
    password: String(dto.password || ''),
    url: String(dto.url || ''),
    note: String(dto.note || ''),
    categoryId: dto.categoryId || '',
    tagIds: Array.isArray(dto.tagIds) ? dto.tagIds.slice() : [],
    createdAt: base.createdAt || now,
    updatedAt: now,
    version: (base.version || 0) + 1,
    deviceId: base.deviceId || vaultService.getMeta().deviceId || '',
    deleted: false,
    usageCount: base.usageCount || 0,
    lastUsedAt: base.lastUsedAt || 0,
    remindAt: dto.remindAt === undefined ? (base.remindAt || 0) : Number(dto.remindAt) || 0
  }
}

const entryService = {
  /**
   * 新建条目。
   * @param {Object} dto 条目数据
   * @returns {Object} 新条目（明文）
   */
  create: function create(dto) {
    validateEntry(dto)
    const entry = buildEntry(dto, null)
    const list = vaultService.getEntries()
    list.unshift(entry)
    vaultService.persist()
    eventBus.emit(EVENTS.VAULT_CHANGED, { reason: 'create', id: entry.id })
    return entry
  },

  /**
   * 更新条目。
   * @param {string} id 条目 ID
   * @param {Object} dto 新数据
   * @returns {Object} 更新后的条目
   */
  update: function update(id, dto) {
    validateEntry(dto)
    const list = vaultService.getEntries()
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        const updated = buildEntry(dto, list[i])
        list[i] = updated
        vaultService.persist()
        eventBus.emit(EVENTS.VAULT_CHANGED, { reason: 'update', id: id })
        return updated
      }
    }
    throw createError(ERROR_CODES.VALIDATION, '条目不存在')
  },

  /**
   * 删除条目（软删除，标记 deleted）。
   * @param {string} id 条目 ID
   */
  remove: function remove(id) {
    const list = vaultService.getEntries()
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i].deleted = true
        list[i].updatedAt = Date.now()
        list[i].version = (list[i].version || 0) + 1
        vaultService.persist()
        eventBus.emit(EVENTS.VAULT_CHANGED, { reason: 'delete', id: id })
        return true
      }
    }
    throw createError(ERROR_CODES.VALIDATION, '条目不存在')
  },

  /**
   * 按 id 取条目。
   * @param {string} id
   * @returns {Object|null}
   */
  get: function get(id) {
    const list = vaultService.getEntries()
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i]
    }
    return null
  },

  /**
   * 记录一次使用（查看/复制），更新计数与时间戳并落盘。
   * @param {string} id
   */
  touch: function touch(id) {
    const entry = this.get(id)
    if (!entry) return
    entry.usageCount = (entry.usageCount || 0) + 1
    entry.lastUsedAt = Date.now()
    vaultService.persist()
  },

  /**
   * 搜索（在内存明文进行，不建明文索引）。
   * @param {string} keyword 关键词
   * @returns {Object[]} 未删除的匹配条目
   */
  search: function search(keyword) {
    const kw = String(keyword || '').trim().toLowerCase()
    const list = vaultService.getEntries().filter(function (e) { return !e.deleted })
    if (!kw) return list.slice()
    return list.filter(function (e) {
      return [e.site, e.account, e.url, e.note].some(function (v) {
        return String(v || '').toLowerCase().indexOf(kw) !== -1
      })
    })
  },

  /**
   * 组合筛选：分类 × 标签 × 关键词。
   * @param {Object} f { keyword, categoryId, tagId, sortBy, desc }
   * @returns {Object[]}
   */
  filter: function filter(f) {
    const o = f || {}
    let list = this.search(o.keyword)
    if (o.categoryId) {
      list = list.filter(function (e) { return e.categoryId === o.categoryId })
    }
    if (o.tagId) {
      list = list.filter(function (e) {
        return Array.isArray(e.tagIds) && e.tagIds.indexOf(o.tagId) !== -1
      })
    }
    const key = o.sortBy || 'updatedAt'
    const desc = o.desc !== false
    list.sort(function (a, b) {
      const av = a[key] || 0
      const bv = b[key] || 0
      if (av === bv) return 0
      return desc ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1)
    })
    return list
  },

  /** @returns {Object[]} 全部未删除条目 */
  listAll: function listAll() {
    return vaultService.getEntries().filter(function (e) { return !e.deleted }).slice()
  }
}

export default entryService
