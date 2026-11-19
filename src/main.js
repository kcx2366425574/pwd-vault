/**
 * uni-app (Vue 3) 入口：创建应用实例、挂载 Vuex、注入全局事件总线。
 * 无第三方 npm 依赖；CryptoJS 由各适配层按需 import 本地单文件。
 *
 * Vue 3 约定：不再使用 new Vue() / Vue.prototype，
 * 改用 createSSRApp + createApp() 导出，全局属性挂到 app.config.globalProperties。
 */
import { createSSRApp } from 'vue'
import App from './App'
import store from './store'
import eventBus from './utils/event-bus.js'
import { EVENTS } from './utils/constants.js'

export function createApp() {
  const app = createSSRApp(App)

  // Vuex 4：通过 app.use 挂载（store/index.js 内用 createStore 创建）
  app.use(store)

  // 全局注入事件总线与事件名常量，页面可用 this.$pvBus / this.$pvEvents
  app.config.globalProperties.$pvBus = eventBus
  app.config.globalProperties.$pvEvents = EVENTS

  return { app }
}
