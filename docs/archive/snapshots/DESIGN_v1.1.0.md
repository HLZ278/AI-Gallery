# PictureSearch 设计归档 v1.1.0

**归档日期**: 2026-05-23  
**版本**: 1.1.0

## 1. 产品目标

本地智能图库：视觉 AI 逐张分析 + 批次统一标记 + 双模式搜索（关键词 / AI 语义）。

## 2. 功能设计

### 2.1 图库与导入

- 用户指定目录建立图库
- 递归扫描图片/视频/GIF
- 自动识别媒体类型（实况/全景/连拍等）
- 生成缩略图缓存

### 2.2 单张 AI 分析

- 调用 OpenAI 兼容视觉 API
- 输出结构化 JSON：描述、物体、人物、场景、故事、潮流标签、OCR 等
- 提示词：`prompts/image_analysis_v1.json`

### 2.3 批次统一标记

- 按拍摄时间聚类（默认 4 小时间隔、最少 3 张）
- 汇总批次内摘要 → 文本 LLM 生成统一活动标签
- 提示词：`prompts/batch_analysis_v1.json`
- 示例：羽毛球赛期间 20 张照片 → 「周末羽毛球赛」

### 2.4 搜索（v1.1 双模式）

| 模式 | 原理 | 传图 | 适用 |
|------|------|------|------|
| 关键词 | SQLite FTS5 + LIKE | 否 | 精确词匹配、速度快 |
| AI 智能 | LLM 阅读文字目录语义匹配 | **否** | 自然语言、同义词、联想 |

AI 搜索设计要点：
- 仅传入已分析图片的**文字详情**（描述、场景、标签、批次信息等）
- 不传图片二进制，降低成本
- 大图库分块请求（`search.chunkSize`），合并 matched_ids
- 提示词：`prompts/llm_search_v1.json`

### 2.5 分析进度 (v1.1)

`AnalysisProgress` 字段：
- `total`, `completed`, `percent` — 总体进度
- `currentFiles[]` — 当前正在分析的文件名
- 展示位置：侧边栏紧凑面板、导入页完整面板

## 3. 索引方案

SQLite FTS5 虚拟表 `media_fts`：
- 单张字段：description, objects, people, scene, location, story, trend_tags, ocr_text
- 批次字段：batch_tags
- AI 搜索不依赖 FTS，直接读 analysis_results 构建目录

## 4. UI 设计

Apple 风格：毛玻璃、12px 圆角、#007AFF 强调色、深浅色 CSS 变量。

页面：搜索（含模式切换）、图库、导入、批次、设置。

## 5. 变更归档机制 (v1.1)

- `docs/archive/CHANGELOG.md` — 主变更日志
- `docs/archive/versions/vX.Y.Z.md` — 版本独立归档
- `docs/archive/snapshots/` — 架构/设计快照
- `ChangeArchiveService` — 运行时追加归档（可选）

## 6. 风险与限制

| 项 | 说明 |
|----|------|
| AI 搜索 token 上限 | 大图库分块，maxCatalogItems 默认 500 |
| 视觉模型 | 分析阶段需 vision 模型；搜索阶段仅需文本模型 |
| 中文 FTS | 关键词模式 LIKE 兜底 |
| 实况照片 | Windows 上识别有限 |

## 7. 后续扩展

- Embedding 向量语义搜索
- 文件变更实时监控
- 虚拟滚动性能优化
