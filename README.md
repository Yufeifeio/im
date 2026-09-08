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
