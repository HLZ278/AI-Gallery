/** registry pipeline → transformers.js 模型类名 */
export const QWEN_VL_PIPELINES = ['qwen2.5-vl', 'qwen3-vl'] as const

export type QwenVLPipelineId = (typeof QWEN_VL_PIPELINES)[number]

export function isQwenVLPipeline(pipeline: string): pipeline is QwenVLPipelineId {
  return (QWEN_VL_PIPELINES as readonly string[]).includes(pipeline)
}

export type QwenVLDtypeConfig = Record<string, string>

export const DEFAULT_QWEN_VL_DTYPE: QwenVLDtypeConfig = {
  embed_tokens: 'fp32',
  vision_encoder: 'fp32',
  decoder_model_merged: 'q4'
}

export async function loadQwenVLModelClass(pipeline: QwenVLPipelineId): Promise<{
  from_pretrained: (
    repo: string,
    opts: Record<string, unknown>
  ) => Promise<unknown>
}> {
  const lib = await import('@huggingface/transformers')
  switch (pipeline) {
    case 'qwen2.5-vl':
      return lib.Qwen2_5_VLForConditionalGeneration
    case 'qwen3-vl':
      return lib.Qwen3VLForConditionalGeneration
    default:
      throw new Error(`未知 Qwen VL pipeline: ${pipeline}`)
  }
}
