# D&M

鏈湴浼樺厛鐨?AI 瀵硅瘽瀹㈡埛绔€侫ndroid / Windows / 娴忚鍣紝涓ゅ浜烘牸涓庝富棰橈細

- **娴呰壊 MOSS**锛氶粦鑹查暅澶淬€佺孩鑹蹭俊鍙凤紝鍐烽潤銆佺悊鎬с€?- **娣辫壊椴搁奔濞?*锛氭繁娴峰啗钃濄€佺炕杞殑 D銆佺缁忕綉缁滅┖鑵旓紝鍌插▏銆佽椽鍚冦€佷細鎾掑▏銆?
API Key銆佸璇濆拰璁剧疆鍙繚瀛樺湪鏈満锛涙病鏈夊箍鍛娿€佺粺璁°€侀仴娴嬫垨绗笁鏂瑰垎鏋?SDK銆?
## 涓嬭浇

浠?GitHub Releases 涓嬭浇鏈€鏂?Android APK锛?
`https://github.com/wangmike007/D-M/releases/latest`

褰撳墠鍏紑鐗堟湰锛?*1.0.0**  
鍖呭悕锛歚com.dm.chat`  
APK SHA-256锛歚6BA8C731D43FEEC72F95780C527F27D7D1390F99197B2A383DF5E91D957DB072`

> 鍙戝竷鍓嶈鎶?`wangmike007` 鎹㈡垚浣犵殑 GitHub 鐢ㄦ埛鍚嶏紝骞舵妸 APK 涓婁紶鍒?Releases銆?
## 鍔熻兘

- 娴佸紡瀵硅瘽銆佹€濊€冨紑鍏充笌鎬濊€冪瓑绾?- DeepSeek 鍙婂吋瀹?HTTPS API
- 澶氬眰绾у瓙浼氳瘽銆侀€変腑鏂囧瓧缁х画杩介棶
- 闄勪欢銆佽闊宠緭鍏ャ€佹湕璇?- 瀵硅瘽涓€閿鍏?/ 瀵煎嚭锛屼笉瀵煎嚭 API Key
- 娴呰壊 / 娣辫壊涓婚锛孉ndroid 鍚姩鍥炬爣闅忎富棰樺垏鎹?- 妗岄潰 / 鎵嬫満鍝嶅簲寮忕晫闈?
## 鎴浘

| 娴呰壊 | 娣辫壊 |
| --- | --- |
| ![娴呰壊](store/screenshot-light.png) | ![娣辫壊](store/screenshot-dark.png) |

## 鏈湴杩愯

闇€瑕?Node.js 18+锛?
```bash
npm install
npm start
```

鎵撳紑 `http://127.0.0.1:3210`銆?
Windows 鐙珛鐗堜娇鐢?Electron锛屽唴缃?Chromium锛涙瀯寤轰骇鐗╀笉鎻愪氦鍒颁粨搴撱€?
## Android

APK 鏄師鐢?WebView 搴旂敤锛屼笉闇€瑕佺數鑴戞垨灞€鍩熺綉锛?
- 鎵嬫満鐩存帴閫氳繃 HTTPS 璇锋眰浣犺缃殑 API
- Key 瀛樺湪 Android 搴旂敤绉佹湁鏁版嵁閲?- 鍙敵璇?`INTERNET` 鍜?`RECORD_AUDIO`
- `allowBackup=false`锛屾嫆缁濇槑鏂?HTTP
- release 绛惧悕锛宼arget SDK 36

Android 婧愮爜鍦?`android/`銆傛瀯寤轰娇鐢?JDK 17銆丄ndroid SDK Platform 36 鍜?Build Tools 34锛岄€氳繃 `aapt2` / `d8` / `apksigner` 鎵嬪姩鎵撳寘锛涘叿浣撳懡浠よ `INSTALL.md`銆?
**绛惧悕瀵嗛挜涓嶆彁浜ゅ埌浠撳簱**銆俙android/signing/` 宸茶 `.gitignore` 蹇界暐銆傚彂甯冭€呭繀椤昏嚜琛屼繚绠?release keystore銆?
## 瀹夊叏涓庨殣绉?
- [SECURITY.md](SECURITY.md) 鈥?瀹夊叏瀹℃煡銆佹畫浣欓闄┿€佸洖鐜湴鍧€闄愬埗
- [store/PRIVACY.md](store/PRIVACY.md) 鈥?闅愮鏀跨瓥鍘熸枃
- [privacy.html](privacy.html) 鈥?鍙儴缃插埌 GitHub Pages 鐨勯殣绉佹斂绛栭〉闈?
涓嶈鎶?`android/signing/`銆乣node_modules/`銆乣.env` 鎴栦换浣曠湡瀹?API Key 鎻愪氦鍒?GitHub銆?
## 璁稿彲

浠ｇ爜涓庡師鍒涘浘鏍囬噰鐢?[MIT License](LICENSE)銆?
MOSS 閫犲瀷鍙傝€冦€婃祦娴湴鐞?2銆嬭瀹氾紝浠呬綔闈炲畼鏂圭晫闈㈣楗帮紱鐩稿叧璁惧畾鐗堟潈褰掔墖鏂规墍鏈夛紝璇﹁ [NOTICE.md](NOTICE.md)銆?
