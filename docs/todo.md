# 完善清单

## v1.7.1 已完成（2026-05-26）

- [x] 提示词自动使用最新版本（PromptRegistry）
- [x] 修复 MediaGrid 虚拟滚动重叠与空白
- [x] 修复 libraryWatcherService 启动未定义
- [x] GIF 默认抽帧 5、视频 8、fps 2

## v1.7.0 已完成

- [x] 文档同步、搜索体验、详情面板、设置项、工作流、错误反馈
- [x] 虚拟滚动 MediaGrid、AI 编辑分页、批量重试、chokidar 监控

## v1.8.3 已完成（2026-05-29）

- [x] AMD GPU：Ollama + Vulkan 视觉分析路径
- [x] 移除 DirectML/auto；GPU 失败显式报错
- [x] JSON/OCR 解析增强、analysis-limits 配置
- [x] 文档 ARCHITECTURE_v1.8.3、CHANGELOG、USER_GUIDE 同步

## v1.8.2 已完成（2026-05-29）

- [x] DirectML GPU 加速（Windows AMD/Intel，失败回退 CPU）
- [x] 图库手动开始分析、正在分析统计、扫描进度
- [x] ImportHelper action、Watcher change、主题 system、ConfirmDialog

## v1.8.1 已完成（2026-05-28）

- [x] LocalInferenceBridge + localInferenceWorker 子进程推理
- [x] 修复 Bridge 启动死锁与 refreshConfig

## v1.8.0 已完成（2026-05-28）

- [x] 本地端侧分析与向量索引（Qwen3-VL / Qwen2.5-VL、BGE、Provider 架构）
- [x] 模型缓存迁至安装目录 `models/`、推理设备 CPU 映射与 DML 回退
- [x] 移除 Qwen2-VL；README 与 CHANGELOG 归档

## 后续可选

- [ ] 图库页内浏览网格
- [ ] 设置页暴露更多高级配置项
- [ ] 快捷键帮助入口扩展到各页面
- [ ] 时间轴视图虚拟滚动
