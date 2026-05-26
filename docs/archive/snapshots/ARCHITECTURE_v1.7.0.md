# AI图库 架构归档 v1.7.0

**归档日期**: 2026-05-23  
**版本**: 1.7.0

## 1. GIF / 视频帧序列分析

```
FileScanner.analyzeFile
    │
    ▼
AnalysisQueue.processOne
    │
    ▼
LLMClient.analyzeFile(filePath)
    ├── photo / live / panorama → image API
    ├── video → VideoFrameExtractor → video 帧序列 API
    └── gif   → GifFrameExtractor → frameSequenceUtils → video 帧序列 API
              │
              ▼
         saveAnalysis → MediaFtsIndexer.upsertMediaFts
              │
              ▼
         EmbeddingService.scheduleIndex
```

## 2. EXIF/GPS 搜索索引

```
FileScanner (exifr GPS pick)
    │
    ▼
media_metadata.exif_json + geo_text
    │
    ├── 导入时 → indexGeoOnlyFts (仅 location 含 GPS)
    └── 分析完成 → upsertMediaFts (location = AI + GPS)

KeywordSearch
    ├── LIKE → analysis_results.* + media_metadata.geo_text
    └── FTS5 → media_fts.location (含 GPS)

EmbeddingTextBuilder
    └── buildEmbeddingDocument(analysis, geoText)
```

## 3. 数据库变更

| 对象 | 变更 |
|------|------|
| `media_metadata.geo_text` | 新增列，存储可搜索 GPS 文本 |
| `schema_migrations` | 新增表，追踪迁移版本 |
| `media_fts` | 无结构变更，`location` 列合并 GPS |

迁移入口：`DatabaseManager.initSchema` → `runMigrations()`

## 4. 重新分析状态流（前端）

```
DetailPanel 点击重新分析
    ├── isRetrying = true → 按钮「分析中」+ disabled
    └── onRetry()
            ├── SearchPage.patchMediaStatus(pending)
            ├── IPC media.retryAnalysis
            └── IPC analysis.start

useAppStore.analysisProgress
    ├── currentFiles 含 mediaId → patch processing
    └── 任务结束 → refreshResults → DetailPanel 清除 isRetrying
```

## 5. 模块清单（v1.7.0）

| 文件 | 职责 |
|------|------|
| `electron/backend/infra/GifFrameExtractor.ts` | GIF 均匀抽帧 |
| `electron/backend/infra/frameSequenceUtils.ts` | 最少帧补齐 |
| `electron/backend/infra/LLMClient.ts` | video 帧序列 API 分支 |
| `electron/backend/domain/ExifGeoText.ts` | EXIF → 搜索文本 |
| `electron/backend/domain/MediaFtsIndexer.ts` | FTS 写入统一入口 |
| `electron/backend/db/migrations.ts` | geo_text 回填与 FTS 重建 |
| `prompts/gif_analysis_v1.json` | GIF 分析提示词 |
| `src/components/DetailPanel.tsx` | 重新分析按钮与状态 |
| `src/pages/SearchPage.tsx` | 乐观更新 + 进度同步 |

## 6. 配置新增

```json
"analysis": {
  "gifPromptVersion": "1.0",
  "gifFrameCount": 8,
  "sequenceFrameFps": 2,
  "sequenceMinFrames": 4
}
```

## 7. 版本演进

| 版本 | 要点 |
|------|------|
| 1.7.0 | GIF 多帧分析、EXIF/GPS 搜索、重新分析交互 |
| 1.6.0 | 局域网传输、二维码、单图分享、更名 AI图库 |
| 1.5.0 | 文生图、AI 编辑、搜索时间轴 |
