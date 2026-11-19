/**
 * Vuex 4 根 Store（uni-app Vue3）。
 *
 * 明文纪律：所有 module 的 state 只允许存放解锁布尔值、时间戳、筛选条件等
 * 非敏感数据；明文条目由 VaultService 在内存中托管，派生密钥由 SessionGuard 托管。
 *
 * 注册模块：auth / settings / vault / sync。
 */
import { createStore } from 'vuex'
import auth from './modules/auth.js'
import settings from './modules/settings.js'
import vault from './modules/vault.js'
import sync from './modules/sync.js'
import eventBus from '../utils/event-bus.js'
import { EVENTS } from '../utils/constants.js'

const store = createStore({
  // 明文与密钥不进 state，无需深度观察；避免 reflow 性能损耗
  strict: false,
  modules: {
    auth,
    settings,
    vault,
    sync
  }
})

// 全局锁定/解锁事件 -> 同步 auth 模块状态。
// 事件由 LockManager / AuthService 广播，Store 只做单向响应，不反向持有服务层引用。
eventBus.on(EVENTS.AUTH_LOCKED, function () {
  store.commit('auth/SET_UNLOCKED', false)
  // 锁定立即清空渲染副本，杜绝锁屏后界面残留明文
  store.commit('vault/CLEAR')
})
eventBus.on(EVENTS.AUTH_UNLOCKED, function () {
  store.commit('auth/SET_UNLOCKED', true)
  store.commit('auth/SET_HAS_VAULT', true)
})

export default store
