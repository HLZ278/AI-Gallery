# AI图库 设计文档

## 1. 项目概述

AI图库 是一款 Windows 智能图库桌面应用，通过视觉大模型对每张图片进行语义分析，并建立可搜索索引，解决传统文件名/EXIF 搜索无法理解「新兴 IP」「梗图」「活动场景」等问题。

### 核心能力

- **图库管理**：用户指定目录建立图库，自动扫描媒体文件
- **单张 AI 分析**：识别元素、人物、场景、故事、位置、潮流标签、图中文字
- **多维搜索**：关键词、向量语义、AI 智能、日期、媒体类型（实况/全景/连拍/动图/视频）
- **可配置模型**：OpenAI 兼容 API，Key / Base URL / Model 均可配置

## 2. 技术架构

```
UI (React) → IPC → Services → Domain → Infrastructure → SQLite / 文件系统
```

| 层级 | 职责 |
|------|------|
| UI | React 页面，Apple 风格，仅通过 IPC 调用后端 |
| Services | LibraryService、ImportService、SearchService、ConfigService |
| Domain | MediaClassifier、AnalysisQueue、PromptBuilder、KeywordSearch |
| Infrastructure | FileScanner、LLMClient、EmbeddingClient、ThumbnailGenerator、Database |

## 3. 索引方案

采用 **SQLite + FTS5 + 向量索引**：

- 结构化字段：日期、媒体类型、图库
- 全文索引：description、objects、people、scene、location、story、trend_tags、ocr_text
- 向量索引：分析详情文本 Embedding，支持语义相似度搜索
- 中文搜索：FTS5 MATCH 失败时回退 LIKE 模糊匹配

## 4. 配置管理

- 默认模板：`config/default.config.json`
- 用户配置：`%APPDATA%/YourPicture/config.json`
- **禁止在源码中硬编码 API Key**

## 5. UI 设计

Apple 风格 Design Token：圆角 12px、毛玻璃侧边栏、#007AFF 强调色、深浅色主题。

页面：搜索、文生图、AI 编辑、图库、导入、设置。

### v1.7.0 变更

- **GIF 多帧 AI 分析**：均匀抽帧 + 百炼 video 帧序列 API
- **EXIF/GPS 地理搜索**：坐标纳入关键词与向量索引，属性 Tab 展示 GPS
- **重新分析**：搜索页 AI 分析 Tab 支持重新分析，点击后立即显示「分析中」

### v1.6.0 变更

- **应用更名**：YourPicture → AI图库
- **局域网传输**：HTTP 服务 + Apple 风格手机网页（上传 / 下载）
- **二维码接入**：导入页选 IP 后展示对应二维码；搜索页右键「局域网分享」扫码下载单图
- **移动页媒体预览**：GIF 自动播放、视频网格内可播放（`inline=1`）
- **多文件传输**：上传修复 FileList 失效；下载逐个保存（可配置间隔）
- **向量搜索修复**：保留相似度排序；索引模型校验与补建提示

### v1.5.0 变更

- **文生图**：qwen-image-2.0-pro，聊天式生成，接受/拒绝入库，历史持久化
- **AI 图片编辑**：图库选图 1~3 张，指令编辑，入库/覆盖/拒绝
- **搜索时间轴**：动态分组视图，按时间排序

### 预览（v1.4.0）

- **单张预览**：双击缩略图，支持旋转、全屏、结果集内切换、预览内右键
- **视频预览**：自定义进度/倍速控件
- **多图对比**：选中图片后选 1–6 张滑动窗口，左右平移比对

## 6. 扩展预留

- 文件变更监控（chokidar）
- 本地视觉模型接入（替换 LLMClient 实现）

## 7. 变更归档

所有版本变动记录在 [archive/CHANGELOG.md](./archive/CHANGELOG.md)。  
架构/设计快照见 [archive/snapshots/](./archive/snapshots/)。

### v1.4.0 变更

- **Apple 风格预览**：旋转、全屏、键盘快捷键、预览内右键（复制/打开位置）
- **视频预览控件**：进度拖动、暂停、倍速
- **多图对比**：1–6 张滑动窗口，左右平移；多种网格布局
- **视频 AI 分析**：ffmpeg 抽帧 + 多帧视觉 API（`video_analysis_v1.json`）

### v1.3.0 变更

- **移除批次功能**：不再按时间聚类、不再生成批次统一标记，简化导入与分析流程
- 搜索与详情仅基于单张 AI 分析结果

### v1.2.0 新增

- **向量语义搜索**：Embedding API + 余弦相似度，模糊描述即可匹配，无需精确关键词
- 搜索页三种模式：关键词（精确） / 向量语义（推荐日常） / AI 智能（全库 LLM 推理）

### v1.1.0 新增

- **分析进度增强**：百分比、当前文件名、进度条（`AnalysisProgressPanel`）
- **AI 智能搜索**：不传图片，传入图库文字详情，LLM 语义匹配（`LLMSearchService`）
- **双模式搜索**：关键词 FTS5 / AI 智能，搜索页可切换
