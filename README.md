# AI图库

AI 驱动的 Windows 智能图库 — 用自然语言搜索本地图片。

## 功能

- 指定目录建立图库，自动扫描图片/视频
- 视觉大模型逐张分析（元素、人物、场景、潮流标签等）
- 关键词 + 日期 + 媒体类型多维搜索
- OpenAI 兼容 API，模型地址可配置
- Apple 风格 UI

## 快速开始

```bash
npm install
npm run dev
```

首次使用请在「设置」页配置 API Key 和视觉模型。

## 文档

- [设计文档](docs/DESIGN.md)
- [开发计划](docs/DEV_PLAN.md)
- [用户指南](docs/USER_GUIDE.md)

## 技术栈

Electron · React · TypeScript · SQLite FTS5 · OpenAI SDK · Sharp

## 打包

```bash
npm run pack
```

## 许可证

MIT
