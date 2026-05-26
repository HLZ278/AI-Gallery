# YourPicture 架构归档 v1.4.0

**归档日期**: 2026-05-23  
**版本**: 1.4.0

## 1. 总体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                 Renderer (React + Zustand)                        │
│  SearchPage │ ChatPage │ LibraryPage │ ImportPage │ Settings     │
└────────────────────────────┬─────────────────────────────────────┘
                             │ IPC (contextBridge)
┌────────────────────────────▼─────────────────────────────────────┐
│                      Main Process                                 │
│  ipc/handlers.ts ──► Services ──► Domain ──► Infrastructure       │
└────────────────────────────┬─────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
     SQLite + FTS5      文件系统 + ffmpeg     用户配置 JSON
     (yourpicture.db)   (thumbnails)         (%APPDATA%/YourPicture)
```

## 2. 预览模块（v1.4 新增）

```
SearchPage / ChatPage
    │ onDoubleClick → MediaPreviewModal(items, index)
    │ MultiPreviewLauncher → MultiImagePreviewModal(source, anchor, size)
    ▼
preview/*
    ├── multiLayout.ts     ← 纯函数：filter / slice / shift window
    ├── VideoPlayerControls
    └── PreviewToolbar
```

**解耦要点**：

- 窗口切片逻辑集中在 `multiLayout.ts`，Modal 只持 `startIndex` 状态
- 预览右键通过 `MediaContextMenu variant="preview"` 复用 IPC，不新增通道
- 全屏逻辑封装为 `useFullscreen` hook

## 3. 视频分析管线（v1.4 新增）

```
AnalysisQueue.processOne()
    → ImageAnalyzer.analyzeFile(path)
        ├─ isVideoFile? → extractVideoFrames (VideoFrameExtractor)
        │                  → analyzeVideoFrames (LLMClient)
        └─ else → prepareImage (sharp) → analyzeImage
```

| 模块 | 路径 | 职责 |
|------|------|------|
| VideoFrameExtractor | `electron/backend/infra/VideoFrameExtractor.ts` | ffmpeg 抽帧、缩略图 |
| LLMClient | `electron/backend/infra/LLMClient.ts` | 图片/多帧视频分析 |
| PromptBuilder | `electron/backend/domain/PromptBuilder.ts` | `loadVideoPrompt()` |
| ImageAnalyzer | `LLMClient.ts` | 按扩展名分流 |

依赖：`ffmpeg-static`（`asarUnpack`）。

## 4. 模块职责（增量）

| 模块 | v1.4 变更 |
|------|-----------|
| MediaService | 无变更；预览复制/打开位置复用现有 IPC |
| AnalysisQueue | 视频走同一队列，失败标记 `failed` |
| FileScanner / ThumbnailGenerator | 视频缩略图改 ffmpeg 抽帧 |
| SearchPage / ChatPage | 预览 state 升级为 `{ items, index }` / multiPreview 窗口 |

## 5. IPC（预览相关，无新增）

| 通道 | 用途 |
|------|------|
| `media:copy` | 预览/网格复制文件 |
| `media:showInFolder` | 打开所在位置 |
| `media:retryAnalysis` | 视频失败后重试 |

## 6. 配置结构（v1.4 增量）

```json
{
  "analysis": {
    "promptVersion": "1.0",
    "videoPromptVersion": "1.0",
    "videoFrameCount": 3,
    "maxImageEdgePx": 1280
  }
}
```

## 7. 前端结构（v1.4）

```
src/components/
├── MediaPreviewModal.tsx
├── MultiImagePreviewModal.tsx
├── MultiPreviewLauncher.tsx
├── MediaGrid.tsx
├── DetailPanel.tsx
└── preview/               # v1.4 子模块
```

## 8. 版本演进

| 版本 | 主要变更 |
|------|----------|
| 1.3.0 | 移除批次、简化导入分析 |
| 1.4.0 | Apple 预览、多图滑动对比、视频 AI 分析、自定义视频控件 |
