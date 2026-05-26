# PictureSearch 架构归档 v1.1.0

**归档日期**: 2026-05-23  
**版本**: 1.1.0

## 1. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer (React + Zustand)                │
│  SearchPage │ LibraryPage │ ImportPage │ Batches │ Settings │
└───────────────────────────┬─────────────────────────────────┘
                            │ IPC (contextBridge)
┌───────────────────────────▼─────────────────────────────────┐
│                     Main Process                             │
│  ipc/handlers.ts ──► Services ──► Domain ──► Infrastructure │
└───────────────────────────┬─────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
    SQLite + FTS5      文件系统缓存         用户配置 JSON
    (picturesearch.db)  (thumbnails)    (%APPDATA%/PictureSearch)
```

## 2. 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| ConfigService | `electron/backend/services/ConfigService.ts` | 加载/保存用户配置，deepMerge 默认值 |
| LibraryService | `electron/backend/services/LibraryService.ts` | 图库 CRUD、目录扫描 |
| ImportService | `electron/backend/services/ImportHelper.ts` | 单文件导入、缩略图 |
| SearchService | `electron/backend/services/SearchService.ts` | 关键词 FTS5 搜索 |
| LLMSearchService | `electron/backend/services/LLMSearchService.ts` | **v1.1** AI 文本语义搜索 |
| ChangeArchiveService | `electron/backend/services/ChangeArchiveService.ts` | **v1.1** 变更归档 |
| AnalysisQueue | `electron/backend/domain/AnalysisQueue.ts` | 分析队列、进度追踪 |
| BatchGrouper | `electron/backend/domain/BatchGrouper.ts` | 时间批次聚类、PromptBuilder |
| LLMClient | `electron/backend/infra/LLMClient.ts` | OpenAI 兼容视觉/文本 API |
| MediaClassifier | `electron/backend/domain/MediaClassifier.ts` | 媒体类型识别 |
| FileScanner | `electron/backend/infra/FileScanner.ts` | 目录扫描、EXIF、缩略图 |

## 3. 数据流

### 3.1 导入与分析

```
用户导入 → FileScanner.analyzeFile → media_items (pending)
       → BatchGrouper.regroupLibrary → media_batches
       → AnalysisQueue → LLMClient (传图) → analysis_results + media_fts
       → BatchAnalysisService → 批次统一标记 → 更新 media_fts.batch_tags
```

### 3.2 搜索（双模式）

**关键词模式**:
```
SearchQuery → FTS5 MATCH / LIKE → media_items
```

**AI 智能搜索 (v1.1)**:
```
SearchQuery → 构建文字目录(不含图片) → 分块 → LLM 文本匹配 → matched_ids → 结果排序
```

## 4. 解耦原则

- UI 仅通过 `window.api` IPC 调用，不直接接触 DB/API
- 提示词全部外置：`prompts/*.json`
- 配置外置：`config/default.config.json` + 用户 `%APPDATA%`
- `LLMClient` / `LLMSearchService` 可独立替换实现
- 搜索模式通过 `SearchQuery.mode` 切换，不侵入 UI 层逻辑

## 5. 配置结构 (v1.1.0)

```json
{
  "llm": { "apiKey", "baseUrl", "model", "maxConcurrency", "timeoutMs", "maxRetries" },
  "analysis": { "promptVersion", "batchPromptVersion", "maxImageEdgePx", "batchGapHours", ... },
  "search": { "llmSearchPromptVersion", "maxCatalogItems", "chunkSize" },
  "ui": { "theme", "gridColumnMinWidth" }
}
```

## 6. 数据库表

- `libraries` — 图库
- `media_items` — 媒体文件（含 batch_id、analysis_status）
- `analysis_results` — 单张 AI 分析
- `media_batches` — 批次统一标记
- `media_fts` — FTS5 全文索引（含 batch_tags）
- `media_metadata` — EXIF 等扩展

## 7. 前端结构

```
src/
├── app/App.tsx          # 路由布局
├── pages/               # 5 个功能页
├── components/          # TitleBar, Sidebar, MediaGrid, DetailPanel, AnalysisProgressPanel
├── store/appStore.ts    # Zustand 全局状态
└── hooks/useAppInit.ts  # IPC 事件订阅
```

## 8. 版本演进记录

| 版本 | 主要变更 |
|------|----------|
| 1.0.0 | 初始架构：图库、分析、批次、关键词搜索 |
| 1.1.0 | 分析进度增强、AI 智能搜索、变更归档体系 |
