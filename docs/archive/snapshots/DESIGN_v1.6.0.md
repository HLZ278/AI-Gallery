# AI图库 设计归档 v1.6.0

**归档日期**: 2026-05-23  
**版本**: 1.6.0

## 1. 产品目标

在 v1.5.0 文生图 / AI 编辑能力之上，补齐 **跨设备导入与分享** 场景：Windows 桌面端作为图库宿主，同一局域网内的手机通过浏览器或扫码完成上传、下载与单图分享。

## 2. 局域网传输

### 2.1 使用流程

1. 设置中启用「局域网传输服务」（默认端口 8765）
2. 导入页 **选择局域网 IP** → 展示该地址二维码
3. 手机扫码 → Apple 风格网页（上传 | 下载 Tab）
4. **上传到电脑**：选择图库 → 相册多选 → 逐文件 POST → `importSingleFile` + 分析队列
5. **下载到手机**：浏览图库 → 多选 → 逐个下载原图
6. **分享单图**：搜索页右键 → 局域网分享 → 选 IP → 扫码下载该文件

### 2.2 二维码交互

- 每个局域网 IP 对应独立 URL，**不默认展示全部二维码**
- 用户在下拉框选择 IP 后，才生成并显示该地址的二维码
- 复用组件 `LanAddressQr`：导入页（首页 URL）、分享弹窗（媒体下载 URL）

### 2.3 移动网页媒体

| 类型 | 展示 |
|------|------|
| 照片 | 缩略图 |
| GIF | 原文件 `<img>`，自动播放 |
| 视频 | `<video controls>`，poster 为缩略图，请求带 `inline=1` |

选择：点缩略图左上角区域；视频/GIF 中间区域用于播放，不触发选择。

### 2.4 多文件传输

- **上传**：`Array.from(files)` 复制后再清空 input，避免 FileList 失效；失败继续下一个
- **下载**：逐个 fetch + blob 触发保存，间隔 `downloadIntervalMs`（默认 1200ms），不打包 ZIP

### 2.5 安全

- 访问令牌（8 位 hex，可重新生成）通过 URL / Header 校验
- 路径校验：仅允许图库根目录与用户数据目录（缩略图）
- 上传扩展名、单文件大小上限可配置

### 2.6 移动网页视觉

- 字体：`-apple-system` / SF Pro 系列
- 背景 `#F5F5F7`，卡片圆角 14px，强调色 `#007AFF`
- 毛玻璃顶栏 / 底栏 Tab

## 3. 架构要点

| 模块 | 路径 |
|------|------|
| HTTP 服务 | `LanServerService` |
| URL 构建 | `shared/lanUrls.ts` |
| 本机 IP | `networkAddresses.ts` |
| 移动页模板 | `lanMobilePage.ts` |
| 二维码 UI | `LanAddressQr` / `lanQr.ts` |
| 导入页 | `LanTransferPanel` |
| 单图分享 | `LanShareModal` + 搜索页右键 |
| 配置 | `config.lanServer` |

用户数据目录仍为 `%APPDATA%/YourPicture/`（内部标识不变）。

## 4. 其他变更

- 应用显示名 **AI图库**（`shared/appMeta.ts`）
- 向量搜索：向量/AI 模式禁用时间重排；索引模型校验与补建提示

## 5. 扩展预留

- mDNS 服务发现（`aigallery.local`）
- HTTPS
- 上传进度 WebSocket 推送
