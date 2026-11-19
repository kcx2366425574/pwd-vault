/**
 * 自动填充桥接（扩展位）。
 *
 * uni-app 纯前端无法实现网站自动填充（需 Android Autofill Framework / 无障碍服务），
 * 故定义 JS ↔ 原生插件通信协议。未安装插件时 isAvailable() 返回 false，
 * 业务层降级为「复制凭证手动填充」。不假设任何原生插件存在。
 *
 * 协议（插件就绪后实现）：
 *   plugin.require('PVAutofill').isAvailable()
 *   plugin.require('PVAutofill').provideCredential(domain) -> {account,password}|null
 *   plugin.require('PVAutofill').saveCredential({domain,account,password})
 */
const autofillBridge = {
  isAvailable: function isAvailable() {
    // #ifdef APP-PLUS
    try {
      // 预留：检测原生插件是否注入
      if (typeof plus !== 'undefined' && plus.nativeObj && typeof plus.require === 'function') {
        return !!plus.require('PVAutofill')
      }
    } catch (e) { /* 未安装插件 */ }
    // #endif
    return false
  },

  provideCredential: function provideCredential(domain) {
    if (!this.isAvailable()) return Promise.resolve(null)
    // #ifdef APP-PLUS
    try {
      const plugin = plus.require('PVAutofill')
      if (plugin && typeof plugin.provideCredential === 'function') {
        return Promise.resolve(plugin.provideCredential(domain))
      }
    } catch (e) { /* 静默 */ }
    // #endif
    return Promise.resolve(null)
  },

  saveCredential: function saveCredential(cred) {
    if (!this.isAvailable()) return false
    // #ifdef APP-PLUS
    try {
      const plugin = plus.require('PVAutofill')
      if (plugin && typeof plugin.saveCredential === 'function') {
        plugin.saveCredential(cred)
        return true
      }
    } catch (e) { /* 静默 */ }
    // #endif
    return false
  }
}

export default autofillBridge
