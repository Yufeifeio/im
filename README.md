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
