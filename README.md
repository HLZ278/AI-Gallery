# AI图库

AI 驱动的 Windows 智能图库 — 用自然语言搜索、理解并编辑本地图片。

> 产品显示名为 **AI图库**，用户数据目录为 `%APPDATA%/YourPicture`（升级兼容保留）。

## 功能

- 指定目录建立图库，自动扫描与目录变更监控
- 视觉大模型逐张分析（人物、场景、IP/角色、潮流标签、OCR、GPS 等）
- 三种搜索：关键词 FTS、向量语义、AI 智能匹配
- 文生图、AI 图片编辑（图库选图 + 指令编辑）
- 局域网传输（手机上传/下载/扫码分享）
- Apple 风格预览（缩放、旋转、全屏、多图对比）
- OpenAI 兼容 API，模型与提示词均可配置

## 快速开始

```bash
npm install
npm run dev
```

首次使用请在「设置」页配置 API Key 和视觉模型（推荐 `qwen-vl-max`）。

## 文档

- [设计文档](docs/DESIGN.md)
- [开发计划](docs/DEV_PLAN.md)
- [用户指南](docs/USER_GUIDE.md)
- [完善清单](docs/todo.md)

## 技术栈

Electron · React · TypeScript · SQLite FTS5 · Embedding · Sharp · FFmpeg · Chokidar · OpenAI SDK

## 打包

```bash
npm run pack
```

安装包输出在 `release` 目录，产品名为 **AI图库**。

## 许可证

MIT
