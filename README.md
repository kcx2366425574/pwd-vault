# 密码保险箱（pwd-vault）

本地优先、端到端加密的个人密码管理器。基于 uni-app + Vue 3，可打包为 Android APK，支持 GitHub Release 在线升级。

## 特性

- **本地加密**：主密码经 PBKDF2 派生密钥，AES-256-CBC + HMAC-SHA256 加密落盘，无明文存储
- **密码管理**：网站名/账号/密码/网址/备注的增删改查、分类、标签、搜索
- **安全工具**：强密码生成器、安全体检、剪贴板定时清空、自动锁定、错误退避
- **生物识别**：指纹/人脸快速验证（真机支持时）
- **数据备份**：加密导入导出（`.pwdvault`）
- **在线升级**：从 GitHub Release 检查新版本并下载安装

## 目录结构

```
├── index.html / vite.config.js / package.json   # Vite + uni-app 工程入口
├── src/
│   ├── config.js             # 版本号、在线升级仓库配置
│   ├── pages/                # 12 个页面
│   ├── components/           # 8 个组件
│   ├── services/             # 业务服务（含 update-service.js）
│   ├── utils/                # 加密/随机/存储/会话/HTTP 等适配层
│   ├── store/                # Vuex 4 状态
│   ├── providers/            # 同步/自动填充提供者
│   └── manifest.json         # App 配置（版本号、权限、AppID）
├── tests/                    # 单元测试 + 真实浏览器 E2E
├── tools/make-update-json.mjs# 生成静态升级清单
├── docs/                     # PRD / 架构 / 发布指南
└── .packrc.json              # 云打包参数
```

## 开发 / 测试

```bash
npm install
npm run dev:h5          # 浏览器运行（HBuilderX 也可"运行到浏览器"）
npm test                # 单元测试（业务闭环 + v-model + 在线升级逻辑）
npm run test:e2e        # 真实 Chrome E2E（需先启动 dev server）
npm run build:h5        # H5 构建
```

## 打包与发布

见 [docs/RELEASE.md](docs/RELEASE.md)。简要流程：

1. 同步版本号：`src/manifest.json` 与 `src/config.js`
2. HBuilderX 云打包（或 `hbuilderx-pack` skill），产物重命名为 `pwd-v<版本>-<code>.apk`
3. 打 tag 并创建 GitHub Release，上传 APK
4. App「设置 → 在线升级」即可检测到新版本

## 安全说明

- 忘记主密码无法找回，加密数据不可恢复
- Release 中的 APK 使用 DCloud 云端证书签名；升级需保持相同签名
- 更新下载地址使用 HTTPS
