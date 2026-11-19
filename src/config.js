/**
 * 应用级配置。
 *
 * 在线升级：填写公开的 GitHub 仓库（owner/repo），App 读取最新 Release，
 * 自动挑选 .apk 资源并下载安装。若 GitHub API 被限流，可配置静态清单 manifestUrl。
 *
 * 发布新版本时，请同步修改 manifest.json 与这里的 versionName/versionCode。
 */
export const APP_META = {
  name: '密码保险箱',
  versionName: '1.0.0',
  versionCode: 100,
  slogan: '本地优先 · 端到端加密',
  update: {
    provider: 'github',
    repo: 'kcx2366425574/pwd-vault',
    manifestUrl: '',
    releasePage: 'https://github.com/kcx2366425574/pwd-vault/releases',
    autoCheck: true
  }
}
