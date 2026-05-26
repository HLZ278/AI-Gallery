# AI图库 开发计划

## 阶段总览

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 0 | 工程脚手架、Apple UI 壳、配置模块 | 已完成 |
| Phase 1 | 图库、扫描、MediaClassifier、SQLite、缩略图 | 已完成 |
| Phase 2 | LLMClient、PromptBuilder、AnalysisQueue、批次分析 | 已完成 |
| Phase 3 | FTS5 搜索、筛选 UI、详情面板 | 已完成 |
| Phase 4 | 主题、打包配置、用户手册 | 已完成 |
| Phase 5 | 分析进度增强、AI 智能搜索、变更归档 | 已完成 |
| Phase 6 | Apple 预览、多图对比、视频 AI 分析 | 已完成 |

---

## Phase 6 — 预览升级 + 视频分析 (v1.4.0)

### 任务

- [x] MediaPreviewModal Apple 风格重构（旋转、全屏、导航、右键）
- [x] VideoPlayerControls 自定义视频控件
- [x] MultiImagePreviewModal 滑动窗口 + 布局 1–6
- [x] MultiPreviewLauncher 搜索/Chat 入口
- [x] VideoFrameExtractor + analyzeVideoFrames
- [x] 文档快照 DESIGN/ARCHITECTURE v1.4.0

### 验收标准

- 双击预览可旋转、全屏、←/→ 切换；关闭按钮始终可点
- 多图对比可左右平移窗口
- mp4 视频可完成 AI 分析
- CHANGELOG 与 snapshots 已归档

---

## Phase 5 — 分析进度 + AI 搜索 + 归档 (v1.1.0)

### 任务

- [x] AnalysisProgress 扩展：total、percent、currentFiles
- [x] AnalysisProgressPanel 组件（侧边栏 + 导入页）
- [x] LLMSearchService：文字目录 + 分块 LLM 匹配
- [x] 搜索页双模式切换
- [x] docs/archive 变更归档体系
- [x] 架构/设计快照 v1.1.0

### 验收标准

- 分析时可见百分比和当前文件名
- AI 搜索不传图片，返回语义匹配结果及理由
- CHANGELOG 与 snapshots 已归档


---

## Phase 0 — 环境搭建

### 任务

- [x] Electron + React + TypeScript + Vite 初始化
- [x] Tailwind CSS + Design Token
- [x] 侧边栏布局 + 自定义标题栏
- [x] ConfigService + 默认配置模板

### 验收标准

- `npm run dev` 可启动空白应用窗口
- 设置页可读写配置文件

---

## Phase 1 — 图库与文件扫描

### 任务

- [x] SQLite schema 迁移
- [x] LibraryService 增删查
- [x] FileScanner 递归目录扫描
- [x] MediaClassifier（视频/GIF/全景/实况/连拍）
- [x] ThumbnailGenerator（sharp）
- [x] 图库页 UI

### 验收标准

- 添加目录后可扫描并显示缩略图网格
- 媒体类型 badge 正确显示

---

## Phase 2 — LLM 分析管线

### 任务

- [x] LLMClient（OpenAI SDK 兼容 DashScope）
- [x] image_analysis_v1.json 提示词模板
- [x] AnalysisQueue 并发队列 + 重试
- [x] 导入流程 + 进度 UI
- ~~[x] BatchGrouper / 批次页~~（v1.3.0 已移除）

### 验收标准

- 导入图片后自动进入分析队列
- 同一时段照片归为一个批次
- 批次分析后生成统一 title / event_tags
- 搜索批次关键词可找到该批所有照片

---

## Phase 3 — 搜索与筛选

### 任务

- [x] FTS5 虚拟表 + 写入同步
- [x] SearchService 关键词 + 日期 + 类型 + 图库
- [x] 中文 LIKE 兜底
- [x] 搜索页 + 筛选 Chips
- [x] DetailPanel 展示分析与批次信息

### 验收标准

- 输入自然语言关键词返回相关图片
- 日期范围、媒体类型筛选生效
- 详情面板显示批次统一标记

---

## Phase 4 —  polish 与打包

### 任务

- [x] 深色/浅色主题 CSS 变量
- [x] electron-builder 配置
- [x] USER_GUIDE.md 用户手册
- [ ] 虚拟滚动（大量图片时，后续优化）

### 验收标准

- `npm run pack` 生成 Windows 安装包
- 用户手册覆盖零基础操作流程

---

## 本地开发命令

```bash
npm install
npm run dev      # 开发模式
npm run build    # 构建
npm run pack     # 打包 exe
```

## 目录说明

见 [DESIGN.md](./DESIGN.md) 第 8 节项目结构。
