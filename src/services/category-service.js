/**
 * 分类管理服务。分类名称加密存储，仅内存明文。
 */
import { ERROR_CODES, BUILTIN_CATEGORIES, createError } from '../utils/constants.js'
import csprng from '../utils/csprng.js'
import vaultService from './vault-service.js'

function findIndex(list, id) {
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return i
  return -1
}

const categoryService = {
  /** @returns {Object[]} 全部分类（明文） */
  list: function list() {
    return vaultService.getCategories().slice()
  },

  /**
   * 新增分类。
   * @param {{name:string, color?:string}} dto
   * @returns {Object}
   */
  create: function create(dto) {
    const name = String((dto && dto.name) || '').trim()
    if (!name) throw createError(ERROR_CODES.VALIDATION, '分类名称不能为空')
    const item = {
      id: csprng.randomId(),
      name: name,
      color: (dto && dto.color) || '#3A6FF8',
      builtin: false,
      createdAt: Date.now()
    }
    vaultService.getCategories().push(item)
    vaultService.persist()
    return item
  },

  /**
   * 重命名/改色。
   * @param {string} id
   * @param {Object} dto
   */
  update: function update(id, dto) {
    const list = vaultService.getCategories()
    const i = findIndex(list, id)
    if (i < 0) throw createError(ERROR_CODES.VALIDATION, '分类不存在')
    if (dto.name !== undefined) {
      const name = String(dto.name).trim()
      if (!name) throw createError(ERROR_CODES.VALIDATION, '分类名称不能为空')
      list[i].name = name
    }
    if (dto.color !== undefined) list[i].color = dto.color
    vaultService.persist()
    return list[i]
  },

  /**
   * 删除分类（内置分类不可删；引用该分类的条目置空分类）。
   * @param {string} id
   */
  remove: function remove(id) {
    const list = vaultService.getCategories()
    const i = findIndex(list, id)
    if (i < 0) throw createError(ERROR_CODES.VALIDATION, '分类不存在')
    if (list[i].builtin) throw createError(ERROR_CODES.VALIDATION, '内置分类不可删除')
    list.splice(i, 1)
    const entries = vaultService.getEntries()
    for (let j = 0; j < entries.length; j++) {
      if (entries[j].categoryId === id) entries[j].categoryId = ''
    }
    vaultService.persist()
  },

  /** 确保内置分类存在（初始化兜底） */
  ensureBuiltin: function ensureBuiltin() {
    const list = vaultService.getCategories()
    const now = Date.now()
    BUILTIN_CATEGORIES.forEach(function (b) {
      const exists = list.some(function (c) { return c.builtin && c.name === b.name })
      if (!exists) {
        list.push({ id: csprng.randomId(), name: b.name, color: b.color, builtin: true, createdAt: now })
      }
    })
    vaultService.persist()
  }
}

export default categoryService
