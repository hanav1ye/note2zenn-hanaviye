import dotenv from "dotenv";
import fs from "node:fs";
import { ConverterConfig, RuntimeConfig } from "../types/config.js";
import { converterConfigPath } from "../utils/paths.js";

/** `.env` を読み込んで環境変数を初期化する。 */
dotenv.config();

/**
 * 実行時設定を環境変数から読み込み、必須値を検証する。
 * @returns 検証済みの実行時設定
 * @throws {Error} 必須環境変数が不足している場合
 */
export const loadRuntimeConfig = (): RuntimeConfig => {
  const llmProvider: string = process.env.LLM_PROVIDER ?? "ollama";
  const zennRepoPath: string = process.env.ZENN_REPO_PATH ?? "";

  if (llmProvider !== "ollama" && llmProvider !== "openai") {
    throw new Error("LLM_PROVIDER must be either 'ollama' or 'openai'.");
  }
  if (!zennRepoPath) {
    throw new Error("ZENN_REPO_PATH is required.");
  }
  if (llmProvider === "openai" && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai.");
  }

  return {
    llmProvider,
    ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL ?? "gemma4:E2B",
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    zennRepoPath
  };
};

/**
 * 変換パラメータのデフォルト設定を返す。
 * @returns 変換設定
 */
export const loadConverterConfig = (): ConverterConfig => {
  const defaultConfig: ConverterConfig = {
    logical_density: { value: 0.7 },
    technical_focus: { value: 0.7 },
    emotional_retention: { value: 0.6 },
    politeness_level: { value: 0.5 },
    free_instruction: ""
  };

  if (!fs.existsSync(converterConfigPath)) {
    return defaultConfig;
  }

  try {
    const rawJson: string = fs.readFileSync(converterConfigPath, "utf-8");
    const parsedJson: unknown = JSON.parse(rawJson);
    return parsedJson as ConverterConfig;
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`converter-config.json is invalid: ${message}`);
  }
};
