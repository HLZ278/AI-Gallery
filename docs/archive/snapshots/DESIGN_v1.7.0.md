# AI图库 设计归档 v1.7.0

**归档日期**: 2026-05-23  
**版本**: 1.7.0

## 1. 产品目标

在 v1.6.0 局域网传输能力之上，增强 **动图/视频类媒体的 AI 理解深度**，并补齐 **拍摄地理信息** 的检索能力；同时优化搜索页单图详情中的 **重新分析** 交互。

## 2. GIF 多帧 AI 分析

### 2.1 动机

单帧 GIF 无法表达动作与叙事，需对动图均匀抽帧后送入视觉模型。

### 2.2 流程

1. `GifFrameExtractor` 从 GIF 均匀抽取 N 帧（默认 8）
2. `frameSequenceUtils` 保证最少 4 帧（不足则重复补齐）
3. `LLMClient.analyzeFile` 对 GIF/视频使用 `type: "video"` 帧序列 API
4. 专用提示词 `prompts/gif_analysis_v1.json`

### 2.3 配置项 `analysis`

| 字段 | 说明 | 默认 |
|------|------|------|
| gifPromptVersion | GIF 分析提示词版本 | 1.0 |
| gifFrameCount | GIF 抽帧数量 | 8 |
| sequenceFrameFps | 帧序列 API fps | 2 |
| sequenceMinFrames | 最少帧数 | 4 |

## 3. EXIF/GPS 地理搜索

### 3.1 动机

拍摄照片常含 GPS EXIF，用户可能按坐标片段搜索，而 AI 语义「位置」与 GPS 坐标不同。

### 3.2 数据流

1. 导入扫描时 `exifr` 读取 GPS 字段 → `media_metadata.exif_json`
2. `ExifGeoText.buildExifGeoText` 生成可搜索文本 → `media_metadata.geo_text`
3. 导入后即写入 FTS（`MediaFtsIndexer.indexGeoOnlyFts`），未 AI 分析也可搜
4. AI 分析完成时 FTS `location` = AI 位置 + GPS 文本
5. 关键词搜索增加 `geo_text` 字段；向量嵌入文档追加 GPS 段

### 3.3 迁移

- `schema_migrations` 表追踪一次性迁移 `geo_search_v1`
- 启动时从 `exif_json` 回填 `geo_text` 并重建 FTS

### 3.4 UI

- 属性 Tab 展示精简 GPS 坐标（`formatGeoDisplay`）

## 4. 重新分析交互

### 4.1 入口

搜索页选中图片 → 右侧详情 → **AI 分析** Tab → 「重新分析」

### 4.2 状态反馈

- 点击后立即本地置灰，文字变为「分析中」
- 乐观更新列表项为 `pending`，监听全局分析进度同步 `processing`
- 分析结束自动刷新搜索结果与侧栏内容

## 5. 架构要点

| 模块 | 路径 |
|------|------|
| GIF 抽帧 | `GifFrameExtractor.ts` |
| 帧序列工具 | `frameSequenceUtils.ts` |
| GPS 文本 | `ExifGeoText.ts` |
| FTS 索引 | `MediaFtsIndexer.ts` |
| DB 迁移 | `migrations.ts` |
| 详情面板 | `DetailPanel.tsx` |
| 搜索页状态 | `SearchPage.tsx` |

## 6. 扩展预留

- GPS 逆地理编码（地名 ↔ 坐标）
- 批量重建 FTS / 向量索引入口
