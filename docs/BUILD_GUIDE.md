# 密码保险箱 · 构建与运行指南

> 技术栈：uni-app + Vue 3 + Vite｜目标：先在浏览器（H5）测试，验证通过后打包 Android APK。

---

## 一、项目结构

```
password-vault/
├── index.html              # H5 入口（Vite）
├── package.json            # 依赖与脚本
├── vite.config.js          # uni-app Vite 插件
├── shims-uni.d.ts          # uni 类型声明
├── .hbuilderx/launch.json  # HBuilderX 启动配置
├── src/                    # 源码（uni-app 标准）
│   ├── App.vue / main.js / pages.json / manifest.json / uni.scss
│   ├── pages/              # 12 个页面
│   ├── components/         # 8 个公共组件
│   ├── services/           # 业务服务层
│   ├── utils/              # 适配层（crypto/csprng/storage/biometric/...）
│   ├── store/              # Vuex 4 状态管理
│   ├── providers/          # 同步/自动填充提供者
│   ├── common/lib/         # CryptoJS 本地备份
│   └── static/             # 静态资源
├── tests/
│   ├── runtime.test.mjs    # 业务闭环测试（24 项）
│   ├── vmodel.test.mjs     # Vue3 v-model 组件级测试（45 项）
│   └── e2e-*.mjs           # 真实浏览器 E2E（首次设置/重开/全页面，共 48 项）
└── docs/                   # PRD / 架构 / 图表
```

---

## 二、环境准备（一次性）

```bash
cd D:\code\password-vault
npm install
```

> 依赖包含 `@dcloudio/uni-app` 3.x、`vue` 3.4、`vuex` 4、`vite` 5、`crypto-js` 4.1.1，与你 D:\code 下其它 uni-app 项目版本一致。

---

## 三、在浏览器运行测试（推荐第一步）

### 方式 A：命令行

```bash
npm run dev:h5
```

启动后打开终端显示的地址（默认 `http://localhost:8080/`）。

### 方式 B：HBuilderX 内运行

1. HBuilderX → 文件 → 导入 → 选择 `D:\code\password-vault`（作为 uni-app 项目导入）
2. 顶部菜单：**运行 → 运行到浏览器 → Chrome**（或内置浏览器）
3. 首次会提示编译，等待完成即可在浏览器看到 App。

### 浏览器测试建议流程

1. **首次进入**：设置主密码（如 `Test!2026abcd`）→ 勾选风险确认 → 完成
2. **录入条目**：新增几条账号密码，用生成器生成强密码
3. **搜索/筛选**：按网站名搜索，按分类筛选
4. **复制密码**：点击复制，观察 30 秒剪贴板清空倒计时
5. **安全体检**：查看弱密码/重复密码检测（故意存一个 `weak` 密码可看到告警）
6. **导入导出**：导出加密备份 → 复制内容 → 粘贴导入验证
7. **自动锁定**：等待设定时长或点设置页「立即锁定」→ 回到解锁页
8. **改密**：设置页修改主密码，验证旧密码失效、新密码可解锁

> **重要**：忘记主密码无法找回。测试请用记牢的密码。

---

## 四、逻辑自检测试

```bash
npm test
```

该测试在 Node 中模拟 H5 环境，跑通 69 项（业务闭环 24 + Vue3 v-model 组件级 45）：主密码设置/解锁、加密落盘无明文、CRUD、搜索、密码生成、安全体检、加密备份、锁定退避、内存清空，以及密码输入框真实双向绑定。全部显示 `ALL PASS` 即核心逻辑正常。

### 浏览器端到端（E2E）测试（推荐，能发现纯逻辑测试发现不了的 UI 问题）

先保持dev server运行（`npm run dev:h5` 或 HBuilderX 运行到浏览器，默认 8080 端口），另开一个终端：

```bash
npm run test:e2e
```

该测试用系统 Chrome 真实打开 App，**模拟真人操作和键盘输入**，覆盖三条完整路径：

- `e2e-browser.mjs`：首次设置主密码 → 新增条目逐字段输入 → 保存 → 列表显示 → 落盘密文校验（14 项）
- `e2e-reopen.mjs`：带数据刷新（模拟重新打开 App）→ 解锁 → 新增条目（13 项）
- `e2e-full.mjs`：遍历全部页面（体检/同步/设置/分类/标签/导入导出/提醒/生成器/搜索/编辑）并捕获组件解析失败与 JS 异常（21 项）

> 说明：**纯逻辑测试无法发现 UI 交互问题**（例如输入值绑不回页面状态、组件未注册）。这类问题只有真实渲染 + 输入才能暴露。E2E 依赖本机 Chrome（`C:/Program Files/Google/Chrome/Application/chrome.exe`），路径不同请修改测试文件顶部的 `CHROME` 常量。

---

## 五、打包 Android APK

### 方式 A：HBuilderX 云打包（最简单）

1. HBuilderX 打开项目 → 顶部菜单 **发行 → 原生 App-云打包**
2. Android 勾选，选择使用「DCloud 公用证书」（测试）或自定义证书（正式）
3. 填写 App 名称、包名，提交，等待云端打包完成
4. 生成的 APK 在 `unpackage/release/apk/` 目录

### 方式 B：本地打包（需 Android SDK）

```bash
npm run build:app
```

产物在 `unpackage/`，再用 Android Studio 签名生成 APK。

### 打包前检查清单

- [ ] `manifest.json` 中 `vueVersion` 为 `3`（已配置）
- [ ] `manifest.json` 中 `minSdkVersion` 为 26（Android 8.0+）
- [ ] 权限声明完整（INTERNET / USE_BIOMETRIC / VIBRATE 等，已配置）
- [ ] 浏览器端功能测试通过
- [ ] `npm test` 全部通过

---

## 六、已知限制与说明

| 功能 | 说明 |
|---|---|
| 网站自动填充 | 需 Android 原生插件（Autofill Framework），当前为「扩展位 + 降级手动填充」；未装插件时复制凭证手动粘贴 |
| 生物识别解锁 | 已用 `uni.startSoterAuthentication` 实现能力检测与认证；因涉及密钥封装，**当前作为快速验证门禁，仍需主密码完成派生解锁**；真机兼容需实测（建议小米/华为/三星 2-3 款） |
| 云同步 | 默认本地/文件占位实现（SyncProvider），完整演示 E2EE 与冲突合并；真实后端（uniCloud/自建/BaaS）待选定后替换 provider 即可，业务层不改 |
| 主题/多语言 | 已实现基础框架（浅色/深色/跟随系统、中英文），在设置页切换 |
| 忘记主密码 | 设计上不可找回（无后门），数据不可恢复 |

---

## 七、安全设计摘要

- **密钥体系**：PBKDF2-HMAC-SHA256（12 万迭代 + 16B 盐）→ HKDF 域分离派生 encKey/macKey
- **加密**：AES-256-CBC + HMAC-SHA256（Encrypt-then-MAC，恒定时间比较）；记录 `E1.<iv>.<ct>.<mac>`，校验块 `PV1.<salt>.<iv>.<ct>.<mac>`
- **落盘**：仅密文，整库单键 `pv.vault` 原子写入；敏感字段（网站/账号/密码/URL/备注/分类标签名）全部加密
- **内存**：明文仅在内存，锁定/切后台/超时立即 wipe；剪贴板 30 秒自动清空
- **同步**：全程只传密文，服务端无密钥（E2EE）；冲突保留双方版本，不静默覆盖
