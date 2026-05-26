# AI图库 变更归档

> 每一次功能变动均记录于此。版本快照见 `versions/` 与 `snapshots/`。

## [1.7.0] - 2026-05-23

### GIF 多帧 AI 分析

- 新增 `GifFrameExtractor`：GIF 均匀抽帧
- 新增 `frameSequenceUtils`：帧序列最少 4 帧补齐
- `LLMClient` 对 GIF 使用百炼 video 帧序列 API（与视频共用路径）
- 新增 `prompts/gif_analysis_v1.json`
- 配置项：`gifPromptVersion`、`gifFrameCount`、`sequenceFrameFps`、`sequenceMinFrames`
- 设置页同步上述配置项

### EXIF/GPS 地理搜索

- 新增 `ExifGeoText`：从 EXIF 生成可搜索 GPS 文本
- 新增 `MediaFtsIndexer`：FTS 写入解耦，location 合并 AI 位置与 GPS
- `media_metadata.geo_text` 列；`schema_migrations` 一次性迁移 `geo_search_v1`
- 导入时即索引 GPS（未 AI 分析可搜）；关键词搜索匹配 `geo_text`
- 向量嵌入文档追加 GPS 段
- 属性 Tab 展示 GPS 坐标

### 搜索页重新分析

- AI 分析 Tab 增加「重新分析」按钮（含已有分析结果时）
- 点击后立即置灰、显示「分析中」
- 搜索页乐观更新状态，监听分析进度同步并刷新结果

## [1.6.0] - 2026-05-23

### 品牌

- 应用显示名改为 **AI图库**（`shared/appMeta.ts`）
- 安装包 productName 同步；用户数据目录保持 `YourPicture` 兼容

### 局域网传输

- 新增 `LanServerService`：本机 HTTP 服务（默认端口 8765）
- Apple 风格手机网页：上传到图库 / 浏览下载图库照片（双 Tab）
- **二维码**：`LanAddressQr` 组件，用户选择局域网 IP 后展示对应二维码（非全部同时展示）
- **局域网分享**：搜索页右键单图分享，扫码直达下载 URL
- URL 构建统一于 `shared/lanUrls.ts`；二维码生成 `qrcode` + `src/utils/lanQr.ts`
- 设置页：启用开关、端口、上传子目录、令牌管理
- 上传复用 `ImportHelper`；下载流式返回原图/缩略图
- 多文件上传：修复清空 input 导致 FileList 失效；同名文件唯一路径
- 多文件下载：逐个 fetch + 保存（`downloadIntervalMs` 可配置），不打包 ZIP
- 移动页 GIF 用原文件播放；视频网格内 `controls` 预览（`inline=1`）

### 搜索

- 向量/AI 模式保留相关度排序，禁用时间重排
- 向量索引模型不一致时明确提示补建

## [1.5.0] - 2026-05-25

### 文生图

- 新增文生图页面：阿里云百炼 qwen-image-2.0-pro 同步 API
- 可选目标图库，生成后接受/拒绝入库
- 聊天历史持久化（`imageGenSession.json`）
- 跨盘保存修复：`rename` 失败时自动 `copy + unlink`

### AI 图片编辑

- 新增 AI 编辑入口：从图库选择 1~3 张图片 + 编辑指令
- API 细节：Base64 传入、格式/大小/分辨率校验、多图顺序、text 置后
- 结果三选一：入库（新文件）、覆盖原图（重新分析）、拒绝
- 编辑历史持久化（`imageEditSession.json`）

### 搜索体验

- 动态时间轴视图（按日/月/年自动分组）
- 按拍摄/导入时间排序，网格/时间轴切换

### 其他

- 移除 AI 助手（Chat）页面
- 移除批次统一标记残留文案

## [1.4.0] - 2026-05-23

### 预览体验升级

- Apple 风格单张预览：旋转、全屏、←/→ 切换、Esc/F/Space 快捷键
- 预览内右键：复制文件、打开文件所在位置
- 修复预览右上角关闭按钮偶发无法点击（z-index / pointer-events）
- 自定义视频播放器：进度拖动、播放/暂停、倍速 0.5x–2x
- 多图对比：搜索/AI 助手页 1–6 张滑动窗口，左右平移一张
- 多图布局：横排 / 2×2 / 上二下三 / 3×2

### 视频 AI 分析

- 新增 `VideoFrameExtractor`（ffmpeg-static 抽帧）
- 新增 `prompts/video_analysis_v1.json`
- 配置项 `videoPromptVersion`、`videoFrameCount`
- 打包 `asarUnpack` ffmpeg 二进制

### 文档

- 设计/架构快照 v1.4.0
- 用户手册补充预览章节

## [1.3.0] - 2026-05-23

### 移除批次功能

- 删除时间聚类、批次统一标记、批次页面及相关 IPC
- 导入流程简化为：扫描 → 导入 → AI 分析
- 搜索与详情仅基于单张 AI 分析结果
- 配置项移除 batchGapHours、batchMinItems 等批次相关字段

## [1.2.1] - 2026-05-23

### AI 分析并发优化

- 改为 Worker 池：有空位立即补上下一张，不再等整批最慢的一张
- 原子认领待分析任务，多路并发不重复处理
- 默认并发 4 路，设置可调 1~16 路

## [1.2.0] - 2026-05-23

### 新增向量语义搜索

- 第三种搜索模式「向量语义」：Embedding + 余弦相似度，无需精确关键词
- 分析完成后自动建立向量索引，设置页可补建历史图片
- 配置项：embedding 模型、最低相似度、topK
- 搜索结果展示相似度百分比

## [1.1.2] - 2026-05-23

### 修复纯英文短词（如 JK）搜不到

- 短 ASCII 词（≤4 字符）不再独占走 FTS5，始终 LIKE 全字段匹配
- FTS 结果与 LIKE 结果合并，避免 FTS 命中其他图导致目标图漏搜
- 支持去空格匹配（「JK 制服」与「JK制服」等价）

## [1.1.1] - 2026-05-23

### 修复关键词搜索覆盖不全与中文匹配差

- 中文关键词改走 LIKE 全字段匹配，不再依赖 FTS5 默认分词
- 扩展搜索字段：人物、物体、位置、氛围、颜色、批次描述/事件类型等
- 支持文件名（路径）匹配；多词空格分隔为 OR 关系

## [1.1.0] - 2026-05-23

### 分析进度增强 + AI 智能搜索 + 文档归档

- 分析进度面板：显示百分比、当前正在分析的文件名、进度条
- 新增 AI 智能搜索：不传图片，仅传入图库已分析详情，由大模型语义匹配
- 搜索页支持「关键词搜索 / AI 智能搜索」切换
- 新增 `prompts/llm_search_v1.json` 搜索提示词模板
- 新增 `ChangeArchiveService` 变更归档服务
- 架构与设计快照归档至 `snapshots/`

## [1.0.0] - 2026-05-23

### 初始版本

- Electron + React + TypeScript 工程搭建
- 图库管理、文件扫描、缩略图、SQLite FTS5 索引
- 视觉大模型逐张分析、批次统一标记
- 关键词 + 日期 + 媒体类型搜索
- Apple 风格 UI、可配置 OpenAI 兼容 API
