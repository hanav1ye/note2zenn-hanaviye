/**
 * 実行時設定と変換パラメータの検証・正規化。
 *
 * 拡張側（note2zennController）で集めた設定値を受け取り、
 * パイプラインが使える RuntimeConfig / ConverterConfig に変換する。
 */
import { ConverterConfig, RuntimeConfig } from "../types/config.js";

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini" as const;

/** 拡張から渡される実行時設定の生データ */
interface RuntimeConfigInput {
  zennRepoPath: string;
  openAiApiKey: string;
  openAiModel?: string;
  analysisMarkdownBasename?: string;
  gitAuthorName?: string;
  gitAuthorEmail?: string;
  githubToken?: string;
}

/**
 * 実行時設定を検証し、必須項目が揃った RuntimeConfig を返す。
 * 任意項目（Git 作者情報など）は値があるときだけ含める。
 */
export const loadRuntimeConfig = (input: RuntimeConfigInput): RuntimeConfig => {
  const zennRepoPath: string = input.zennRepoPath.trim();
  const openAiApiKey: string = input.openAiApiKey.trim();
  if (!zennRepoPath) {
    throw new Error("zennRepoPath is required.");
  }
  if (!openAiApiKey) {
    throw new Error("OpenAI API key is required.");
  }
  const analysisMarkdownBasename = input.analysisMarkdownBasename?.trim();

  return {
    openAiApiKey,
    openAiModel: input.openAiModel?.trim() || DEFAULT_OPENAI_MODEL,
    zennRepoPath,
    ...(input.gitAuthorName?.trim() ? { gitAuthorName: input.gitAuthorName.trim() } : {}),
    ...(input.gitAuthorEmail?.trim() ? { gitAuthorEmail: input.gitAuthorEmail.trim() } : {}),
    ...(input.githubToken?.trim() ? { githubToken: input.githubToken.trim() } : {}),
    ...(analysisMarkdownBasename ? { analysisMarkdownBasename } : {})
  };
};

// --- ConverterConfig（LLM リライトのトーン調整） ---

/** note2zenn.converterConfig 未設定時のデフォルト値 */
const defaultConverterConfig: ConverterConfig = {
  logical_density: { value: 0.7 },
  technical_focus: { value: 0.7 },
  emotional_retention: { value: 0.6 },
  politeness_level: { value: 0.5 },
  free_instruction: ""
};

/** 0.0〜1.0 の範囲外や NaN を安全な値に丸める */
const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
};

/**
 * 拡張設定の converterConfig を正規化する。
 * キーが欠けていても defaultConverterConfig で補完し、value は clamp01 する。
 */
export const loadConverterConfig = (rawConfig: unknown): ConverterConfig => {
  if (!rawConfig || typeof rawConfig !== "object") {
    return defaultConverterConfig;
  }
  const parsed = rawConfig as Partial<ConverterConfig>;
  const normalize = (value: unknown, fallback: number): { value: number } => {
    if (!value || typeof value !== "object") {
      return { value: fallback };
    }
    const candidate = value as { value?: unknown };
    return { value: clamp01(typeof candidate.value === "number" ? candidate.value : fallback) };
  };
  return {
    logical_density: normalize(parsed.logical_density, defaultConverterConfig.logical_density.value),
    technical_focus: normalize(parsed.technical_focus, defaultConverterConfig.technical_focus.value),
    emotional_retention: normalize(parsed.emotional_retention, defaultConverterConfig.emotional_retention.value),
    politeness_level: normalize(parsed.politeness_level, defaultConverterConfig.politeness_level.value),
    free_instruction: typeof parsed.free_instruction === "string" ? parsed.free_instruction : "",
    ...(parsed.options && typeof parsed.options === "object" ? { options: parsed.options } : {})
  };
};
