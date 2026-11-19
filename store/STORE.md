# D&M Android 公开发行资料

版本：1.0.0  
包名：`com.dm.chat`  
目标 SDK：36  
最低系统：Android 8.0（API 26）  
AAB：`dist/D&M-1.0.0.aab`  
APK：`dist/D&M-1.0.0.apk`  
签名证书 SHA-256：`37:81:4a:84:92:7c:62:e0:93:3a:10:59:43:87:4e:4b:99:4d:3c:3b:83:78:e7:0c:46:84:5d:34:90:cd:e6:9a`

## Google Play 商品文案

**应用名称**：D&M

**简短说明**：本地优先的 AI 对话，MOSS 与鲸鱼娘双人格。

**完整说明**：

D&M 是一个本地优先的 AI 对话客户端，为 Android 带来两种完整人格：

- 浅色 MOSS：冷静、理性、以“延续人类文明”为元指令。
- 深色鲸鱼娘：住在网上的小鲸鱼，傲娇、贪吃、会撒娇。

主要功能：

- 自带 API Key，对话和设置只保存在本机应用私有空间。
- 支持 DeepSeek 及兼容 API 服务。
- 流式回答、思考等级、联网检索、附件、语音输入和朗读。
- 多层级子会话与选中文字继续追问。
- 对话一键导入 / 导出，不导出 API Key。
- 浅色 / 深色主题，启动图标随主题切换。

隐私说明：D&M 不收集、不出售、不共享你的数据；没有广告、统计或第三方分析 SDK。只有你主动发送消息时，内容才会通过 HTTPS 发送到你设置的 API 服务。

**分类**：效率  
**标签**：AI、对话、效率  
**内容分级**：13+（用户生成内容 / AI 生成内容）  
**联系方式**：请替换为你的邮箱和隐私政策 HTTPS 地址。

## 素材

- `store/icon-512.png`：512×512 Play 图标
- `store/feature-graphic.png`：1024×500 置顶大图
- `store/screenshot-light.png`：浅色手机截图（1080×2340）
- `store/screenshot-dark.png`：深色手机截图（1080×2340）
- `store/PRIVACY.md`：隐私政策，需要你托管到 HTTPS 页面上架时填入

## 数据安全表单建议

- 开发者是否收集数据：否（开发者不运营服务器，不接收用户数据）
- 数据是否加密传输：是（HTTPS）
- 用户是否可以要求删除：是（清除应用数据或卸载）
- 是否包含广告：否
- 是否包含第三方分析：否
- 是否允许用户创建账号：否
- 注意：用户主动发送的消息会发送给用户配置的 API 服务商，需在表单中如实说明“用户主动发起的第三方 API 请求”。

## 发布步骤

1. 登录 Google Play Console，创建应用，包名 `com.dm.chat`。
2. 上传 `dist/D&M-1.0.0.aab`。
3. 启用 Play App Signing；上传密钥就是 `android/signing/dm-release.jks`。
4. 填写商店文案、截图、图标和已托管的隐私政策 URL。
5. 完成数据安全表单、内容分级、目标受众。
6. 内测 → 封闭测试（如需要）→ 生产发布。

## 签名密钥备份

**必须备份**：

- `android/signing/dm-release.jks`
- `android/signing/password.txt`
- `android/signing/keystore.properties`

这些文件不进入 APK，也不应该公开分享。丢失 upload key 会导致无法更新同一个应用；如果启用 Play App Signing，可在 Play Console 申请重置 upload key。
