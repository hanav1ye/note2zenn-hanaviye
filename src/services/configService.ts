import { ConverterConfig, RuntimeConfig } from "../types/config.js";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini" as const;

/**
 * 実行時設定を受け取り、必須値を検証する。
 * VSCode 拡張側で収集した設定値/秘密情報をここで統一的に検証する。
 */
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
 * 実行時設定を入力値から読み込み、必須値を検証する。
 * @returns 検証済みの実行時設定
 * @throws {Error} 必須値が不足している場合
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

/**
 * 変換パラメータのデフォルト設定。
 */
const defaultConverterConfig: ConverterConfig = {
  logical_density: { value: 0.7 },
  technical_focus: { value: 0.7 },
  emotional_retention: { value: 0.6 },
  politeness_level: { value: 0.5 },
  free_instruction: ""
};

/**
 * 設定値を 0.0-1.0 の範囲に丸める。
 */
const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
};

/**
 * 変換パラメータ設定オブジェクトを検証/正規化して返す。
 * 拡張設定で一部キーが欠けてもデフォルト値で補完する。
 * @returns 変換設定
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
