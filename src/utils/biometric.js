/**
 * 生物识别适配层。
 *
 * App 端：使用 uni-app Soter 认证（指纹/人脸），仅本地验证，不上传任何生物特征。
 * H5 / 其他端：无任何生物能力，isSupported 返回全 false，业务层据此回退主密码。
 *
 * 安全边界：生物识别只作为「解锁本地密钥」的便利手段，不改变底层加密方案。
 */
const biometric = {
  /**
   * 能力探测。
   * @returns {Promise<{fingerPrint:boolean, facId:boolean, available:boolean}>}
   */
  isSupported: function isSupported() {
    // #ifdef APP-PLUS
    try {
      if (typeof uni !== 'undefined' && typeof uni.getSoterSupport === 'function') {
        return new Promise(function (resolve) {
          uni.getSoterSupport({
            success: function (res) {
              resolve({
                fingerPrint: !!(res && res.fingerPrint),
                facId: !!(res && res.facId),
                available: !!(res && (res.fingerPrint || res.facId))
              })
            },
            fail: function () { resolve({ fingerPrint: false, facId: false, available: false }) }
          })
        })
      }
    } catch (e) {
      // 落到下方降级
    }
    // #endif
    return Promise.resolve({ fingerPrint: false, facId: false, available: false })
  },

  /**
   * 发起生物认证。
   * @param {Object} opts { challenge, reason }
   * @returns {Promise<{success:boolean, code?:string}>}
   */
  authenticate: function authenticate(opts) {
    // #ifdef APP-PLUS
    try {
      if (typeof uni !== 'undefined' && typeof uni.startSoterAuthentication === 'function') {
        const o = opts || {}
        return new Promise(function (resolve) {
          uni.startSoterAuthentication({
            requestAuthModes: ['fingerPrint', 'facId'],
            challenge: o.challenge || 'pv-auth',
            authContent: o.reason || '验证以解锁密码库',
            success: function () { resolve({ success: true }) },
            fail: function (err) {
              resolve({ success: false, code: (err && err.errCode !== undefined) ? String(err.errCode) : 'E_BIOMETRIC' })
            }
          })
        })
      }
    } catch (e) {
      // 落到下方降级
    }
    // #endif
    return Promise.resolve({ success: false, code: 'E_BIOMETRIC_UNSUPPORTED' })
  }
}

export default biometric
