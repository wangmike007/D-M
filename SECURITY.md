# D&M 安全审查与隐私说明

审查日期：2026-11-19  
审查范围：Node 服务端、浏览器前端、PWA service worker、Electron 桌面壳  
版本：0.56.0

## 结论

D&M 的数据流是本地优先的：

- 对话、附件、设置和 API Key 只存在当前浏览器的 `localStorage`。
- API Key 只通过本机回环地址发给本机 Node 代理，再由代理放进 `Authorization` 头请求上游 API。
- 服务端不把请求体、Key 或对话内容写入日志。
- 没有统计、遥测、广告、第三方脚本或外部字体。
- 服务端现在只允许绑定 `127.0.0.1` / `localhost` / `::1`，拒绝暴露到局域网或公网。

但必须说清楚：**API Key 仍以明文存在浏览器 localStorage 里**。这是本机浏览器客户端无法完全消除的残余风险；如果电脑被入侵、浏览器扩展作恶、或你使用共享的 Windows 账户，Key 仍可能被读取。

## 已修复的问题

| 级别 | 问题 | 处理 |
| --- | --- | --- |
| 高 | `HOST` 环境变量可把服务绑定到 `0.0.0.0`，使局域网可访问 | 启动时拒绝非回环地址，直接退出 |
| 高 | 浏览器跨站请求 / DNS rebinding 可尝试调用本机 API | 校验 `Host` 必须为本机回环；API 请求校验 `Origin` 必须是同源 |
| 中 | 自定义 Base URL 允许远程 `http://`，Key 可能明文走网络 | 远程地址强制 HTTPS；`http://` 只允许 `127.0.0.1` / `localhost` / `::1` |
| 中 | PWA 缓存可能误存 API 响应 | service worker 明确跳过所有 `/api/` 请求，只缓存静态壳 |
| 低 | 服务端日志可能包含敏感路径 | 只记录方法、路径、状态、耗时；不记录请求体、查询参数、Key |
| 低 | 缺少部分浏览器安全头 | 增加 CSP、`X-Frame-Options`、`nosniff`、`Referrer-Policy`、COOP/CORP |

## 数据流

1. 浏览器把 Key 写入 `localStorage`（`whalechat.v1.settings`）。
2. 发消息时，Key 放进本机请求头 `x-api-key`，请求发往 `http://127.0.0.1:3210/api/chat`。
3. Node 代理校验 Host/Origin、读取 Key，然后向上游 API 发 `Authorization: Bearer`。
4. 上游 SSE 原样回传；代理不落盘、不记录内容。
5. service worker 只缓存静态文件，不缓存 `/api/chat`、`/api/balance`、附件或 Key。

## 残余风险

- **本机恶意软件**：能读取浏览器配置或进程内存，任何 Web 客户端都无法防御。
- **浏览器扩展**：有权限读取页面 localStorage 的扩展可以读取 Key。建议只使用可信扩展。
- **自定义 Base URL**：如果你把 Base URL 改成第三方 HTTPS 地址，Key 会发给该地址。只填你信任的服务商。
- **上游服务商**：DeepSeek 或你配置的兼容服务会收到 Key 和对话内容，这是 API 调用的必要部分。
- **共享账户**：Windows 账户或 Edge 配置被他人使用，Key 可被读取。建议使用独立 Windows 账户 / 独立 Edge 配置，并开启磁盘加密。
- **手机端**：当前服务端只监听回环地址，手机不能直接访问电脑的 `127.0.0.1`。不要为了手机访问把端口改成 `0.0.0.0`；那会让同一网络的人有机会访问你的本机 API。

## 验证记录

- 正常请求 `GET /api/health`：200。
- 伪造 `Host: evil.test`：421。
- 伪造跨站 `Origin` 调 API：403。
- 远程 `http://` Base URL：400。
- 响应头包含 CSP、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`。
- 静态文件路径解析限制在 `public/` 内，拒绝目录穿越。
- 请求体上限 8 MB；Key 长度上限 4096。
- 服务端日志只输出 `METHOD /path status ms`。
- service worker 缓存实测只有 12 个静态资源，`/api/` 条目为 0；用假 Key 写入 localStorage 后，缓存里也没有该 Key。
- Electron 桌面版不包含、不读取、不写入 API Key；只在本机回环地址启动内置服务。
- Electron 窗口关闭 `nodeIntegration`、开启 `contextIsolation` 与 `sandbox`，没有 preload；拒绝窗口外跳转、弹窗和 webview；权限只允许本机地址的麦克风/剪贴板。
- Electron 内置服务使用随机回环端口；关闭窗口时结束子进程。

## 桌面运行时风险

- 独立版内置 Electron 33 / Chromium。它比系统 Edge 更容易落后，必须随 D&M 版本更新运行时。
- Electron 与 Chromium 的历史漏洞属于运行时风险；本版本没有自动更新通道，更新需要重新分发安装目录。
- 不加载任何远程页面；窗口只加载 `http://127.0.0.1:<随机端口>/`。

## 发布前建议

1. 不要把 `D&M.exe` 和 `public/` 暴露到公网。
2. 不要把 `node server.mjs` 的 `HOST` 改成 `0.0.0.0`。
3. 定期轮换 DeepSeek API Key。
4. 如果怀疑 Key 泄露：立刻在 DeepSeek 控制台撤销旧 Key，再在 D&M 设置里换新 Key。
5. 不要在共享电脑上保存 Key；使用完可在设置里清空。

## Android 客户端

- APK 是原生 WebView 壳，界面资源打包在 `assets/www`，不启动本机 Node 服务，也不要求电脑在线。
- 手机直接通过 HTTPS 调 DeepSeek（或用户设置的其他 HTTPS Base URL），Key 不经过电脑。
- Key 存在 Android 应用私有数据目录的 WebView localStorage；`allowBackup=false`，不进入系统备份。
- Manifest 只申请 `INTERNET` 和 `RECORD_AUDIO`；没有存储、相机、定位权限，没有第三方 SDK、广告或统计。
- `usesCleartextTraffic=false` + Network Security Config，拒绝明文 HTTP。
- 外部网页链接交给系统浏览器；WebView 本身禁止跳转到非本地页面，没有 JavaScript Bridge。
- CSP meta 限制脚本、连接和资源；只允许本地资源和 HTTPS API。
- 残余风险：`allowUniversalAccessFromFileURLs` 为兼容本地模块加载而开启；只加载内置可信资源，页面不允许外部导航。
- 当前 APK 使用调试证书签名；公开分发前必须改用 release keystore。

### Android 验证

- 在 Android 14 模拟器安装并启动 APK，WebView 本地资源正常加载。
- 用假 Key 调 `/api/balance` 和 `/api/chat`，均返回上游 401，证明请求确实走手机直连 HTTPS，Key 没有经过电脑代理。
- APK 内没有真实 Key、对话记录或用户数据。

### 主题图标绑定

- Android 用两个 `activity-alias` 分别绑定浅色/深色图标，应用通过只读的 `DMNative.setTheme()` JS Bridge 通知原生层切换；Bridge 只暴露这一个方法，不能读取 Key 或对话。
- Windows 通过只暴露 `setTheme()` 的 preload + IPC 切换窗口/任务栏图标；exe 文件图标固定。
- favicon 由页面按主题切换；已安装 PWA 的桌面图标由系统固定。

### 对话导出/导入

- 导出 JSON 只包含对话对象，不包含 `settings`、API Key、Base URL 或系统提示词；已实测假 Key 不在导出文件中。
- 导入限制 20 MB，重新生成对话和消息 ID，避免覆盖现有数据。
- Android 的 `DMNative.saveFile()` 只允许写入导出 JSON，文件名会清洗，大小上限 20 MB，没有读取文件的桥接能力。
- 当前没有局域网直传服务；避免把含对话数据的 HTTP 端口暴露到局域网。

### 公开发行签名

- 1.0.0 使用独立的 4096-bit RSA release keystore 签名，target SDK 36；不再使用 Android debug 证书。
- APK 使用 v2/v3 签名；AAB 使用 jarsigner 签名并通过 bundletool validate。
- `android/signing/` 不进入 APK、AAB、Windows 包或 `store/`；必须离线备份。
- 发布包没有 WebView 调试开关，没有 `debuggable`。
