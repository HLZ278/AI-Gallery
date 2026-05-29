# AI图库 架构归档 v1.8.3

**归档日期**: 2026-05-29  
**版本**: 1.8.3

## 1. 分析总入口

```
UI (图库/导入/详情)
    │ IPC: analysis:start | media:retryAnalysis | media:enhanceAnalysis
    ▼
AnalysisQueue.processOne()
    ├── resolveAnalysisMode()     → local | cloud（可回退）
    ├── createImageAnalysisProvider(mode)
    └── provider.analyzeFile(filePath, mediaId)
            → mapStructuredPayload / mapLocalCaptionToPayload
            → SQLite analysis_results + EmbeddingService
```

| IPC | 行为 |
|-----|------|
| `analysis:start` | 批量分析 pending 项 |
| `media:retryAnalysis` | 本地重新分析 |
| `media:enhanceAnalysis` | 强制云端（需 API Key） |

**模式解析**（`AnalysisProviderFactory.resolveAnalysisMode`）：

- `cloud` → 百炼 OpenAI 兼容 API
- `local` + `inferenceDevice=amd` → Ollama（需 runtime + 模型就绪）
- `local` + `wasm`/`cuda` → ONNX 子进程
- 本地未就绪 + `fallbackToCloudWhenLocalUnavailable` + 有 Key → 云端

## 2. 三种 Provider

```
createImageAnalysisProvider(mode)
    mode=cloud  → CloudImageAnalysisProvider
    mode=local + amd → OllamaImageAnalysisProvider
    mode=local + wasm/cuda → LocalImageAnalysisProvider
```

### 2.1 云端 CloudImageAnalysisProvider

- **协议**: OpenAI SDK `chat.completions.create`
- **配置**: `config.json` → `llm.baseUrl` / `model` / `apiKey`（默认百炼兼容端点）
- **提示词**: `prompts/image_analysis_v1.1.json`（图片）、`video_analysis_v1.1.json`、`gif_analysis_v1.1.json`

| 媒体 | API 形态 | 预处理 |
|------|----------|--------|
| 图片 | 1× chat，`image_url` base64 | sharp 缩放 maxImageEdgePx |
| 视频 | 1× chat，`type: video` 多帧 data URL + fps | ffmpeg 抽 videoFrameCount 帧 |
| GIF | 1× chat，同上，gif 提示词 | 抽 gifFrameCount 帧 |

### 2.2 本地 ONNX LocalImageAnalysisProvider

- **协议**: 主进程 `LocalInferenceBridge` ↔ 子进程 `localInferenceWorker` IPC
- **引擎**: `QwenVLCaptionEngine` → `@huggingface/transformers` ONNX `model.generate()`
- **配置**: `config/local-models.json`、`inferenceDevice`（wasm→CPU，cuda→GPU）
- **提示词**: `local_caption_instruction`（与云端语义对齐，输出 JSON）

| 媒体 | 调用次数 | 说明 |
|------|----------|------|
| 图片 | 1× generate | `captionFromPath` |
| 视频/GIF | N× generate（逐帧） | `captionFromFrames` → `mergeFrameCaptions` |

### 2.3 本地 AMD OllamaImageAnalysisProvider

- **协议**: `POST http://127.0.0.1:11434/api/chat`
- **配置**: `config/ollama-runtime.json`（baseUrl、visionModels、gpuEnv、chatRequest）
- **模型 tag**: `localModels.ollamaVisionModelTag` 或 registry `ollamaModel`
- **向量**: 仍走 BGE ONNX，与 Ollama 解耦

| 媒体 | 调用次数 | 请求体 |
|------|----------|--------|
| 图片 | 1× /api/chat | `messages[].images=[base64]`，`think:false` |
| 视频/GIF | N× /api/chat（逐帧） | 同左，帧合并后解析 |

**Ollama 相关 IPC**: `ollama:getStatus` / `setup` / `pullModel` / `getVisionCatalog`

## 3. 媒体预处理（共用 MediaPreprocessor）

| 类型 | 处理 |
|------|------|
| 图片 | sharp 旋转 + 缩放 JPEG |
| 视频 | ffmpeg 抽帧 → 缩放 → padFrameBuffers(min 4) |
| GIF | 抽帧 → 同上 |

配置项：`analysis.maxImageEdgePx`、`videoFrameCount`、`gifFrameCount`、`sequenceMinFrames`

## 4. 结果解析（共用）

```
模型文本输出
    → stripMarkdownFence（剥 ```json）
    → extractJsonObject（完整 / 截断 / 字段级容错）
    → sanitizeAnalysisPayload（analysis-limits.json）
    → analysis_results + media_fts
```

日志前缀：`[Ollama]`、`[AnalysisParse]`

## 5. 配置清单

| 文件 | 用途 |
|------|------|
| `config/default.config.json` | 默认 analysis / llm / localModels |
| `config/local-models.json` | ONNX 与 Ollama 模型 registry |
| `config/ollama-runtime.json` | Ollama 安装、Vulkan 环境、视觉 catalog |
| `config/inference-devices.json` | 设备标签与错误提示 |
| `config/analysis-limits.json` | OCR/文本字段长度上限 |
| `prompts/image_analysis_v1.1.json` | 云端 + 本地 caption 提示词 |

## 6. 目录与缓存

| 路径 | 内容 |
|------|------|
| `{安装目录}/models/` | ONNX 权重（Qwen VL、BGE） |
| `{安装目录}/ollama-models/` | Ollama 视觉模型 |
| `%APPDATA%/YourPicture/config.json` | 用户配置 |
| `%APPDATA%/YourPicture/` | SQLite 数据库 |

## 7. 版本演进

| 版本 | 分析相关要点 |
|------|----------------|
| 1.8.3 | AMD/Ollama 路径；DirectML 移除；JSON/OCR 解析增强 |
| 1.8.2 | DirectML（已在 1.8.3 移除）、图库手动分析 |
| 1.8.1 | 推理子进程 LocalInferenceBridge |
| 1.8.0 | 本地 Qwen3-VL ONNX + Provider 工厂 |
