# AI图库 架构归档 v1.6.0

**归档日期**: 2026-05-23  
**版本**: 1.6.0

## 1. 分层（LAN 通道）

```
手机浏览器
    │ HTTP (局域网)
    ▼
LanServerService
    ├── GET  /                         → lanMobilePage HTML
    ├── GET  /api/status               → 图库列表、downloadIntervalMs
    ├── GET  /api/media                → 分页媒体 JSON（含 mediaType）
    ├── GET  /api/media/:id/thumb      → 缩略图流
    ├── GET  /api/media/:id/file       → 原文件（attachment 或 ?inline=1 预览）
    └── POST /api/upload               → 图库子目录 → ImportHelper
         │
         ▼
ImportHelper.importSingleFile → AnalysisQueue

桌面 React ──IPC──► lanServer:getStatus / regenerateToken
    ├── LanTransferPanel + LanAddressQr（导入页二维码）
    └── LanShareModal（搜索页单图分享二维码）
```

LAN 与 IPC 导入 **共享 ImportHelper**，URL 统一 **shared/lanUrls.ts**。

## 2. 配置 `lanServer`

| 字段 | 说明 |
|------|------|
| enabled | 是否启动 HTTP 服务 |
| port | 监听端口，默认 8765 |
| token | 访问令牌，空则首次启动自动生成 |
| uploadSubfolder | 上传保存相对图库根的子目录 |
| pageSize | 移动页分页大小 |
| maxUploadBytes | 单文件上限（默认 50MB） |
| downloadIntervalMs | 多文件逐个下载间隔（默认 1200ms） |
| allowedExtensions | 允许的上传扩展名 |

## 3. IPC

| 通道 | 说明 |
|------|------|
| lanServer:getStatus | IP 列表、端口、令牌、运行状态 |
| lanServer:regenerateToken | 重新生成令牌并重启服务 |
| lanServer:uploadComplete | 主进程 → 渲染进程推送 |

## 4. 生命周期

- `main.ts` → `app.whenReady` → `lanServerService.applyConfig()`
- `config:save` → `applyConfig()` 热重启
- `window-all-closed` → `stop()`

## 5. 模块清单（v1.6.0）

| 文件 | 职责 |
|------|------|
| `electron/backend/services/LanServerService.ts` | HTTP 路由、上传、文件流 |
| `electron/backend/infra/networkAddresses.ts` | 本机 IPv4 |
| `electron/backend/infra/lanMobilePage.ts` | 移动网页模板 |
| `shared/lanUrls.ts` | 页面/媒体 URL 构建 |
| `shared/appMeta.ts` | APP_DISPLAY_NAME |
| `src/components/LanTransferPanel.tsx` | 导入页局域网区块 |
| `src/components/LanAddressQr.tsx` | IP 选择 + 二维码 |
| `src/components/LanShareModal.tsx` | 单图分享弹窗 |
| `src/utils/lanQr.ts` | QR DataURL 生成 |

## 6. 依赖

- `qrcode`：渲染进程生成二维码 DataURL

## 7. 版本演进

| 版本 | 要点 |
|------|------|
| 1.6.0 | 局域网传输、二维码、单图分享、移动预览、多文件修复、更名 AI图库、向量搜索修复 |
| 1.5.0 | 文生图、AI 编辑、搜索时间轴 |
| 1.4.0 | 预览升级、视频分析 |
