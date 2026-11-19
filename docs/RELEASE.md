# 发布与在线升级

## 一、版本号

发布前同步三处：

1. `src/manifest.json` 的 `versionName` / `versionCode`
2. `src/config.js` 的 `APP_META.versionName` / `versionCode`
3. Release 正文中的 `versionCode: N`

`versionCode` 必须是递增整数；升级判断优先用它，缺失时按 `versionName` 语义版本比较。

## 二、构建 APK

使用 `hbuilderx-pack` skill 或 HBuilderX 云打包：

```bash
python "C:/Users/asus/.workbuddy/skills/hbuilderx-pack/scripts/pack_app.py" \
  --project "D:/code/password-vault"
```

参数来自 `.packrc.json`（slug=pwd、包名 `com.pwdvault.app`、证书类型 3=云端证书）。
产物自动重命名为 `pwd-v<versionName>-<versionCode>.apk`，放入 `dist/release/apk/`。

> 需 HBuilderX 已登录 DCloud 账号。云端证书可覆盖安装；如需换自有证书，务必保持一致，否则老用户无法覆盖升级。

## 三、发布到 GitHub Release

1. 推送代码并打 tag：`v1.0.0`
2. 创建 Release，上传：
   - `pwd-v1.0.0-100.apk`（必须）
3. 正文示例：

```text
versionCode: 100
- 首个正式版本

[force] 仅在确实需要强制升级时添加
```

App 内「设置 → 在线升级」读取路径：
`https://api.github.com/repos/kcx2366425574/pwd-vault/releases/latest`

仓库需为**公开**，否则 App 无法匿名下载 APK。

## 四、静态 update.json（备用）

适合 GitHub API 限流或被墙。生成：

```bash
node tools/make-update-json.mjs \
  --version 1.0.0 --code 100 \
  --apk https://github.com/kcx2366425574/pwd-vault/releases/download/v1.0.0/pwd-v1.0.0-100.apk \
  --notes "首个版本" --page https://github.com/kcx2366425574/pwd-vault/releases/tag/v1.0.0 \
  --out update.json
```

把 `update.json` 放仓库根目录，用 jsDelivr 地址：
`https://cdn.jsdelivr.net/gh/kcx2366425574/pwd-vault@main/update.json`

在 `src/config.js` 的 `update.manifestUrl` 填入该地址即可走静态清单。

## 五、App 内升级流程

1. 启动时静默检查（12 小时一次），有新版本给设置 Tab 加红点。
2. 打开「设置 → 在线升级」查看版本说明。
3. App 端 `plus.downloader` 下载到 `_doc/pwd-vault-update.apk`，显示进度。
4. `plus.runtime.install` 拉起系统安装；首次安装需允许"安装未知应用"。
5. H5 环境退化为打开发布页。

## 六、安全

- 不要提交签名证书、密码等私密信息。
- 更新下载地址使用 HTTPS。
- 仅安装 APK，不从 Release 执行脚本。
