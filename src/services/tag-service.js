/**
 * 标签管理服务。标签名称加密存储，仅内存明文。
 */
import { ERROR_CODES, createError } from '../utils/constants.js'
import csprng from '../utils/csprng.js'
import vaultService from './vault-service.js'
import entryService from './entry-service.js'

const COLORS = ['#3A6FF8', '#22A06B', '#E6A23C', '#8E6CE4', '#F56C6C', '#909399', '#00A6A6', '#EB6CA4']

function findIndex(list, id) {
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return i
  return -1
}

const tagService = {
  /** @returns {Object[]} 全部标签（明文） */
  list: function list() {
    return vaultService.getTags().slice()
  },

  /**
   * 新增标签。
   * @param {{name:string, color?:string}} dto
   */
  create: function create(dto) {
    const name = String((dto && dto.name) || '').trim()
    if (!name) throw createError(ERROR_CODES.VALIDATION, '标签名称不能为空')
    const list = vaultService.getTags()
    const color = (dto && dto.color) || COLORS[list.length % COLORS.length]
    const item = { id: csprng.randomId(), name: name, color: color, createdAt: Date.now() }
    list.push(item)
    vaultService.persist()
    return item
  },

  /**
   * 更新标签。
   * @param {string} id
   * @param {Object} dto
   */
  update: function update(id, dto) {
    const list = vaultService.getTags()
    const i = findIndex(list, id)
    if (i < 0) throw createError(ERROR_CODES.VALIDATION, '标签不存在')
    if (dto.name !== undefined) {
      const name = String(dto.name).trim()
      if (!name) throw createError(ERROR_CODES.VALIDATION, '标签名称不能为空')
      list[i].name = name
    }
    if (dto.color !== undefined) list[i].color = dto.color
    vaultService.persist()
    return list[i]
  },

  /**
   * 删除标签（同时从所有条目的 tagIds 移除）。
   * @param {string} id
   */
  remove: function remove(id) {
    const list = vaultService.getTags()
    const i = findIndex(list, id)
    if (i < 0) throw createError(ERROR_CODES.VALIDATION, '标签不存在')
    list.splice(i, 1)
    const entries = vaultService.getEntries()
    for (let j = 0; j < entries.length; j++) {
      if (Array.isArray(entries[j].tagIds)) {
        entries[j].tagIds = entries[j].tagIds.filter(function (t) { return t !== id })
      }
    }
    vaultService.persist()
  },

  /** @returns {string[]} 可选颜色 */
  palette: function palette() { return COLORS.slice() }
}

export default tagService
