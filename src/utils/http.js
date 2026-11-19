/**
 * 轻量网络请求封装：H5 用 fetch，App 端用 uni.request（避免 WebView 跨域与证书问题）。
 * 仅返回文本与状态码，供在线升级解析 JSON 使用。
 */

function hasUni() {
  return typeof uni !== 'undefined' && uni && typeof uni.request === 'function'
}

/**
 * GET 请求，返回 { status, text }。
 */
export function getText(url, options = {}) {
  const headers = Object.assign(
    {
      Accept: 'application/vnd.github+json, application/json;q=0.9, */*;q=0.8',
      'User-Agent': 'pwd-vault-updater'
    },
    options.headers || {}
  )
  const timeout = options.timeout || 20000

  if (!hasUni()) {
    // H5 / Node 浏览器环境
    return fetch(url, { method: 'GET', headers, cache: 'no-store' })
      .then(async function (resp) {
        const text = await resp.text()
        if (resp.status >= 400) {
          const err = new Error('HTTP ' + resp.status)
          err.status = resp.status
          throw err
        }
        return { status: resp.status, text: text }
      })
  }

  // App 端：uni.request
  return new Promise(function (resolve, reject) {
    uni.request({
      url: url,
      method: 'GET',
      header: headers,
      timeout: timeout,
      success: function (res) {
        let text = res.data
        if (typeof text !== 'string') text = JSON.stringify(text)
        if (res.statusCode >= 400) {
          const err = new Error('HTTP ' + res.statusCode)
          err.status = res.statusCode
          reject(err)
          return
        }
        resolve({ status: res.statusCode, text: text })
      },
      fail: function (e) { reject(new Error((e && e.errMsg) || '网络请求失败')) }
    })
  })
}
