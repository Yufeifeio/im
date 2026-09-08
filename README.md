# IM System

自有品牌 IM 系统。生产业务 API 使用 PostgreSQL 持久化，并通过统一登录会话连接聊天服务；当前已交付真实 Web 聊天基线、签到与会员流程。商城、会议和管理后台仍按后续阶段实施，未完成部分不会返回伪造成功结果。

## 启动

```bash
node server/index.js
```

默认监听 `http://127.0.0.1:8080`，生产需设置 `DATABASE_URL`、`TINODE_PUBLIC_APP_KEY` 和 `BUSINESS_TIMEZONE`（参见 `.env.example`）。接口使用 `Authorization: Bearer TOKEN`。未设置数据库时仅允许显式 `ALLOW_LEGACY_DEV=1` 启动开发兼容模式。

## 版本与后续集成

- Node.js 20+
- Tinode 服务端/客户端、LiveKit 版本在接入前固定并记录；本仓库保留独立业务边界，不修改 Tinode 内部数据库。
- Android/iOS 原生工程、推送、签名及真机验收需在确定客户端交付端和证书资料后接入。

## Tinode 本地联调

已固定 Tinode `v0.25.0`（commit `6547a66c4dbb0cb4c017588c95183e96168ffa03`）。配置文件使用环境变量替换生产凭据；`config.tinode*.conf` 为本机联调配置，不得复制到生产。

```bash
./scripts/setup-services.sh
./bin/tinode-db --config=./config.tinode-db.conf
./bin/tinode --config=./config.tinode.conf
```

## HTTPS 入口
域名：im.cyfljj.com、api.cyfljj.com、rtc.cyfljj.com。
独立 Nginx 配置为 deploy/nginx.conf，避免启动或覆盖其他站点。
证书由 Certbot 保存在 /etc/letsencrypt/live/im-cyfljj-com/，私钥不进入仓库。
HTTP 除 ACME 验证路径外返回 308 跳转 HTTPS。续期采用 /var/lib/im-acme
webroot，续期成功后重新加载独立 Nginx。
当前三个 HTTPS 入口有意返回 503 service_not_ready；这是未完成业务联调的真实状态，
不是可交付聊天或会议服务。接入真实客户端和安全审查后再配置代理。

## 已接入的真实聊天基线
- Web 开发验收入口：https://im.cyfljj.com
- Tinode WebSocket：wss://api.cyfljj.com/v0/channels
- rtc.cyfljj.com 仍返回 503，尚未接入会议。
- Tinode 与 Web 均固定 v0.25.0，分别保留 GPL 和 Apache 许可证，
  上游源码由 scripts/fetch-upstream.sh 获取并校验 commit。
- 官方 Web 客户端已构建，非之前的演示首页。业务后端账号尚未与 Tinode 统一，
  请勿把旧 Node JSON 接口作为生产接口。本次没有接入会员、支付或会议。

构建：执行 scripts/fetch-upstream.sh，在 third_party/tinode 下执行
go build -tags postgres -o ../../bin/tinode ./server。
数据库初始化使用上游 tinode-db 工具（禁止使用 reset），当前开发库已初始化。
scripts/configure-tinode.py 仅供本机已有空 Tinode 库使用，会在没有用户时生成私有密钥，
已有配置或账号时拒绝覆盖。业务数据库迁移尚未完成。
配置保存在 .runtime/tinode.json（0600），不提交 Git；数据库权限使用非超级用户。
scripts/setup-services.sh 安装独立 im-chat 系统服务。
scripts/build-web.sh 使用上游 npm 锁文件构建并部署 Web。
deploy/im-edge.service 与 deploy/nginx.conf 是唯一 HTTPS 入口，reload 使用 systemd 主进程信号。

验证：
node tests/chat.mjs
CHAT_WS=wss://api.cyfljj.com/v0/channels node --use-system-ca tests/chat.mjs
测试实际创建随机账号、建群、邀请、投递、补拉和 Token 登录，并删除自己的测试数据。
已验证协议与 HTTPS 路径；浏览器操作回归、私聊、文件、语音、推送、密码找回、
原生客户端及容量验收仍待完成。不以 HTTP 200 代替功能验收。

### 聊天回归更新
现已验证私聊、同账号双连接消息同步、普通群成员提权被拒绝、
真实文件上传和鉴权下载、HTTPS 跨域，以及 Chromium 实际账号登录。
官方 Web 的域名自动检测已在构建脚本中修正为 api.cyfljj.com。
文件接口 /v0/file/ 通过 HTTPS 代理，文件保存于私有 .runtime/uploads；
未登录下载返回 401。上传限制 8 MiB，未接入对象存储。

浏览器测试（使用已安装 Chrome，或先执行 npx playwright install chromium）：
BROWSER_TEST=1 CHROMIUM_PATH=/path/to/chrome CHAT_WS=wss://api.cyfljj.com/v0/channels node --use-system-ca tests/chat.mjs
Playwright 固定为开发依赖，不进入客户端包。测试未禁用 TLS 校验。
仍未验收：图像/语音 UI 操作、离线长时间恢复、服务重启持久性、多端在线统计、
移动原生客户端及目标容量。媒体下载采用上游登录鉴权语义，不宣称额外的逐会话附件 ACL。

### 用户界面品牌
scripts/brand-web.py 在官方源码构建时应用 IM 名称、图标、标题和支持页修改。
用户页面不展示上游品牌、SDK 版本或仓库链接；源码许可证、版权和内部协议标识保留。
正式品牌名称/Logo、客服地址和法律条款尚待提供；支持页入口暂禁用并明确说明。
浏览器已验证登录前后无上游品牌及仓库链接，另已验证断开连接后的历史补拉。

## 原生客户端（Android 调试构建通过，设备验收未完成）
Android 固定 v0.25.0，iOS 固定最新可用稳定标签 v1.24.4（上游自述仍为 beta），
具体 commit 记录在 third_party/*.version。保留官方 Gradle/Xcode 工程与 Apache 许可证，
通过 scripts/fetch-upstream.sh 恢复源码，不采用 WebView 套壳。

scripts/configure-native.py 配置非管理权限的公开 app key、api.cyfljj.com 和 TLS，
可重复执行。客户端不存在数据库或媒体管理密钥。
Android 修复上游 MaxPermSize 参数和强制读取 release keystore 的问题；
无 Firebase 配置时明确禁用相关构建任务，并防止访问未初始化 Firebase。
这不等于推送功能可用。生产签名文件尚未配置，包名/App Group 等保留原工程值，
正式发布前需要确认并统一修改标识与签名。

Android 环境：JDK 21、Gradle wrapper 8.13、AGP 8.13.2、API 36；
SDK 安装在 /opt/im-android-sdk。
ANDROID_HOME=/opt/im-android-sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 bash scripts/build-android.sh
产物位置：third_party/android/app/build/outputs/（仅构建成功后存在）。
Android APK/AAB 调试构建已通过；设备登录尚未验证，不作为原生功能完整交付。

iOS：在 macOS 上安装 Xcode、按 Podfile.lock 安装 CocoaPods 依赖，
执行 scripts/build-ios.sh 进行无签名模拟器编译。
当前 Linux 主机没有 Xcode，尚未执行此编译，也未验证与 0.25 服务端的端到端兼容性。
待提供 macOS 构建环境、Apple Team/签名、推送配置和可用设备。

### Android 构建验证
执行 scripts/build-android.sh 已通过 assembleDebug、bundleDebug、
tinodesdk:testDebugUnitTest 和 app:testDebugUnitTest。
实际 57 项单元测试、0 失败、0 错误；测试结果位于上游各模块 build/test-results，
无需额外复制报告。scripts/verify-android.sh 校验 APK v2 签名、manifest、
AAB 完整性并打印 SHA-256。

产物保留在原生工程标准 outputs 目录，不提交二进制到 Git：
- third_party/android/app/build/outputs/apk/debug/app-debug.apk
- third_party/android/app/build/outputs/bundle/debug/app-debug.aab

显示名称 IM，最低 Android API 27，target API 36。
仍为调试签名及上游开发包名，不是商店发布包；App 内所有品牌细节尚需设备巡检。
adb devices 未检测到设备，主机没有 /dev/kvm，未进行安装或模拟器运行验收。
macOS/Xcode、Apple 签名、Firebase 项目和推送配置仍未提供。
其他开发机可通过 TINODE_PUBLIC_APP_KEY 传入非管理员应用标识，
配置脚本验证标识格式及非管理员位；不需要复制服务端私有配置到开发机。
