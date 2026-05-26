# YourPicture 设计归档 v1.4.0

**归档日期**: 2026-05-23  
**版本**: 1.4.0

## 1. 产品目标

在 v1.3.0 去除批次、简化分析管线的基础上，强化**浏览与比对体验**，并补齐**视频 AI 理解**能力。

## 2. 预览系统设计

### 2.1 单张预览 `MediaPreviewModal`

| 能力 | 说明 |
|------|------|
| 视觉 | 深色背景 `#0a0a0a/95`，圆角媒体，毛玻璃工具栏 |
| 导航 | 传入 `items[]` + `initialIndex`，支持结果集内切换 |
| 旋转 | 视图层 `transform: rotate()`，不修改文件 |
| 全屏 | `Element.requestFullscreen()`，Esc 先退全屏再关闭 |
| 右键 | 复用 `MediaContextMenu` 的 `preview` 变体（复制文件、打开所在位置） |
| 视频 | 委托 `VideoPlayerControls` 自定义控件 |

**层级约定（修复关闭按钮）**：

- 顶栏 / 侧栏导航 / 底栏：`z-30`
- 关闭按钮：`z-40` + `stopPropagation`
- 内容区：`z-0` + `pointer-events-none`，仅媒体元素 `pointer-events-auto`

### 2.2 视频播放器 `VideoPlayerControls`

- 进度条 pointer 拖动
- 倍速下拉：0.5 / 0.75 / 1 / 1.25 / 1.5 / 2
- 暴露 `VideoPlayerHandle.togglePlay()` 供空格键调用

### 2.3 多图对比 `MultiImagePreviewModal`

**滑动窗口模型**：

```
sourceItems（搜索结果）
    → filterPreviewableImages()
    → windowStartIndex + windowSize(1–6)
    → getWindowAt() 切片
    → 左右 shift ±1
```

**布局（CSS Grid）**：

| 张数 | 布局 |
|------|------|
| 1 | 单格居中 |
| 2–3 | 横排等宽 |
| 4 | 2×2 |
| 5 | 上 2（各 span 3/6）下 3（各 span 2/6） |
| 6 | 3×2 |

入口组件 `MultiPreviewLauncher`：选中图片类型媒体后显示 1–6 按钮。

### 2.4 快捷键

| 键 | 单张预览 | 多图对比 |
|----|----------|----------|
| Esc | 关闭 / 退全屏 | 同左 |
| ← → | 上一张 / 下一张 | 窗口前移 / 后移 |
| F | 全屏 | 全屏 |
| Space | 视频播放/暂停 | — |

## 3. 视频 AI 分析

### 3.1 问题

mp4 等视频不能直接交给 sharp / 视觉 API 当图片处理。

### 3.2 方案

```
VideoFrameExtractor (ffmpeg-static)
    → 按 duration 取 N 个 seek 点（默认 3：首/中/尾）
    → 抽帧 JPEG
LLMClient.prepareVideoFrames()
    → resize + base64
LLMClient.analyzeVideoFrames()
    → 多图 + prompts/video_analysis_v1.json
```

配置：

```json
"analysis": {
  "videoPromptVersion": "1.0",
  "videoFrameCount": 3
}
```

打包：`asarUnpack` 解压 `ffmpeg-static` 二进制。

## 4. 组件结构

```
src/components/
├── MediaPreviewModal.tsx       # 单张/视频预览入口
├── MultiImagePreviewModal.tsx  # 多图滑动窗口
├── MultiPreviewLauncher.tsx    # 1–6 张入口
├── MediaContextMenu.tsx        # full | preview 变体
└── preview/
    ├── VideoPlayerControls.tsx
    ├── PreviewToolbar.tsx
    ├── multiLayout.ts          # 窗口切片与布局 class
    ├── useFullscreen.ts
    └── icons.tsx
```

## 5. 与 v1.3.0 差异

| 项目 | v1.3.0 | v1.4.0 |
|------|--------|--------|
| 预览 | 简单 Modal + 原生 video | Apple 风格 + 自定义控件 |
| 多图 | 无 | 滑动窗口对比 |
| 视频分析 | 失败（当图片处理） | ffmpeg 抽帧 + 多帧 LLM |
| 预览右键 | 无 | 复制 / 打开位置 |

## 6. 扩展预留

- 多图对比可选包含视频首帧
- 旋转角度持久化至 metadata
- 触摸滑动切换（Surface 设备）
