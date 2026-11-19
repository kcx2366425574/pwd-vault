/**
 * sync 模块（Vuex 4 / uni-app Vue3）。仅保存非敏感的同步状态。
 */
const state = () => ({
  status: 'idle', // idle | syncing | success | error | conflict
  lastSyncAt: 0,
  message: '',
  conflicts: []
})

const mutations = {
  SET_STATUS: function (state, payload) {
    state.status = (payload && payload.status) || 'idle'
    state.message = (payload && payload.message) || ''
  },
  SET_LAST_SYNC: function (state, ts) { state.lastSyncAt = Number(ts) || 0 },
  SET_CONFLICTS: function (state, list) { state.conflicts = Array.isArray(list) ? list : [] }
}

const actions = {
  report: function ({ commit }, payload) { commit('SET_STATUS', payload) },
  reset: function ({ commit }) {
    commit('SET_STATUS', { status: 'idle', message: '' })
    commit('SET_CONFLICTS', [])
  }
}

export default { namespaced: true, state, getters: {}, mutations, actions }
