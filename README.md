# IM System

基于 Tinode 协议兼容方向的 IM 业务扩展服务，当前包含可运行的业务 API 骨架：账号、签到、商城商品/订单、会员数据结构预留及多人会议记录/在线参会统计。数据以 `data/state.json` 持久化，适用于隔离开发环境；正式环境接入 PostgreSQL、Tinode 和 LiveKit 前需配置对应服务。

## 启动

```bash
node server/index.js
```

默认监听 `http://127.0.0.1:8080`，可通过 `PORT`、`DATA_DIR`、`BUSINESS_TIMEZONE` 配置。接口使用 `Authorization: Bearer TOKEN`。

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
