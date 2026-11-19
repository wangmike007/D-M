# D&M 安装说明

## Windows 桌面版

要求：

- Windows 10/11
- 不需要单独安装 Node.js
- 不需要单独安装 Edge

使用：

1. 解压 `D&M-Standalone-Windows.zip` 到任意目录。
2. 双击里面的 `D&M.exe`。
3. 它自带 Electron/Chromium 运行时，会在本机回环地址启动服务并显示独立窗口。
4. 关闭窗口后，应用启动的服务一起退出。

`D&M.exe` 不包含 API Key，也不会把 Key 写到安装目录；Key 只保存在当前 Windows 用户的 D&M 应用数据里。

## 浏览器 / PWA 桌面安装

1. 启动 `node server.mjs`。
2. 用 Edge 或 Chrome 打开 `http://127.0.0.1:3210`。
3. 地址栏右侧选择“安装 D&M”或“应用 → 安装此站点”。
4. 安装后用独立窗口运行；断网时静态界面仍可打开，但发消息仍需 API。

## Android 手机版

APK：`D&M-Android.apk`，支持 Android 8.0（API 26）及以上。

安装：

1. 把 APK 传到手机。
2. 在系统设置里允许当前文件管理器“安装未知应用”。
3. 安装并打开 D&M。
4. 在设置里填入 API Key。

它是独立的 WebView 应用：

- 不需要电脑，不需要 Node，不需要局域网。
- 界面资源打包在 APK 内。
- 发消息时由手机直接通过 HTTPS 请求 DeepSeek API；Key 只保存在手机应用私有数据里，不经过电脑代理。
- 需要麦克风权限时才会弹出录音授权。

注意：当前 APK 使用 Android 调试证书签名，适合自己安装使用；如果要公开分发或长期更新，应换成自己的 release keystore 重新签名。

不要通过 `HOST=0.0.0.0` 或端口转发把电脑端服务暴露给手机；Android 版不需要这样做。

## 对话导出 / 导入

- 设置 → 数据：导出全部对话、导入对话。
- 对话卡片右上角「⋯」：导出当前对话。
- 导出文件只包含对话标题、消息和附件元数据，不包含 API Key、接口设置或系统提示词。
- Android 导出的文件写入「下载/D&M」；也可以再用系统分享发送到另一台设备。
- 导入会生成新的对话 ID，不覆盖现有对话；单个文件上限 20 MB。

## 局域网互传

当前没有把 D&M 服务暴露到局域网，也没有做未加密的局域网直传。两台设备可以用系统 Nearby Share / AirDrop / 文件传输发送导出的 JSON，再在另一台 D&M 里导入。

## Android 公开发行版

- Release APK：`dist/D&M-1.0.0.apk`（release keystore 签名，target SDK 36）。
- Play AAB：`dist/D&M-1.0.0.aab`（已通过 bundletool validate，使用 upload key 签名）。
- 如果手机装过旧调试签名版，先卸载旧版再装 release 版；签名不同不能覆盖安装。
- Play Console 上传 AAB，并把 `android/signing/dm-release.jks` 作为 upload key 备份。
- 商店素材和文案在 `store/`；隐私政策里的联系邮箱与 URL 需要你替换。
- **不要公开分享 `android/signing/` 里的 keystore 和密码。** 丢失后无法更新同一应用。若启用 Play App Signing，可在控制台重置 upload key。
