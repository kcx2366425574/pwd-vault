/**
 * vault 模块（Vuex 4 / uni-app Vue3）。
 *
 * 明文纪律：本模块只保存「用于渲染的条目副本」与筛选条件，
 * 权威明文集合由 VaultService 在内存中托管。锁定事件到来时必须立即清空 entries。
 */
const state = () => ({
  /** 供页面渲染的条目副本（明文，仅内存，锁定即清空） */
  entries: [],
  categories: [],
  tags: [],
  /** 筛选条件（非敏感） */
  keyword: '',
  categoryId: '',
  tagId: '',
  sortBy: 'updatedAt',
  sortDesc: true
})

const getters = {
  visibleEntries: function (state) {
    let list = state.entries.slice()
    const kw = (state.keyword || '').trim().toLowerCase()
    if (kw) {
      list = list.filter(function (e) {
        return [e.site, e.account, e.url, e.note].some(function (v) {
          return String(v || '').toLowerCase().indexOf(kw) !== -1
        })
      })
    }
    if (state.categoryId) {
      list = list.filter(function (e) { return e.categoryId === state.categoryId })
    }
    if (state.tagId) {
      list = list.filter(function (e) {
        return Array.isArray(e.tagIds) && e.tagIds.indexOf(state.tagId) !== -1
      })
    }
    const key = state.sortBy || 'updatedAt'
    list.sort(function (a, b) {
      const av = a[key] || 0
      const bv = b[key] || 0
      if (av === bv) return 0
      return state.sortDesc ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1)
    })
    return list
  }
}

const mutations = {
  SET_ENTRIES: function (state, list) { state.entries = Array.isArray(list) ? list : [] },
  SET_CATEGORIES: function (state, list) { state.categories = Array.isArray(list) ? list : [] },
  SET_TAGS: function (state, list) { state.tags = Array.isArray(list) ? list : [] },
  SET_KEYWORD: function (state, v) { state.keyword = v || '' },
  SET_CATEGORY_FILTER: function (state, v) { state.categoryId = v || '' },
  SET_TAG_FILTER: function (state, v) { state.tagId = v || '' },
  SET_SORT: function (state, payload) {
    if (payload && payload.by) state.sortBy = payload.by
    if (payload && typeof payload.desc === 'boolean') state.sortDesc = payload.desc
  },
  CLEAR: function (state) {
    state.entries = []
    state.categories = []
    state.tags = []
    state.keyword = ''
    state.categoryId = ''
    state.tagId = ''
  }
}

const actions = {
  /** 从 VaultService 刷新内存副本到 store（由页面在解锁后调用） */
  refresh: function ({ commit }, vaultService) {
    if (!vaultService) return
    commit('SET_ENTRIES', vaultService.decryptAll())
    commit('SET_CATEGORIES', vaultService.getCategories().slice())
    commit('SET_TAGS', vaultService.getTags().slice())
  },
  clearAll: function ({ commit }) { commit('CLEAR') }
}

export default { namespaced: true, state, getters, mutations, actions }
