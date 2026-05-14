import fs from "node:fs/promises";
import OpenAI from "openai";
import { ConverterConfig, FewShotExample, ParameterSetting, RuntimeConfig } from "../types/config.js";
import { promptPath } from "../utils/paths.js";

/** リライト推論のサンプリング温度。変換再現性のため0に固定する。 */
const INFERENCE_TEMPERATURE = 0 as const;

/** Ollama の生成上限トークン数（num_predict）。 */
const OLLAMA_NUM_PREDICT = 4096 as const;

/**
 * `converter_config` のキー意味をユーザープロンプトに載せる用。
 * `ConverterConfig`（`src/types/config.ts`）の JSDoc と整合させる。
 */
const CONVERTER_CONFIG_PARAMETER_LEGEND_LINES: readonly string[] = [
  "converter_config の各キーの意味（各軸の value は強度 0.0〜1.0）:",
  "- logical_density: 論理的・結論優先の度合い",
  "- technical_focus: 技術用語やコード解説の度合い",
  "- emotional_retention: 筆者の感想や情緒的表現の度合い",
  "- politeness_level: 丁寧語（です・ます）を強制する度合い",
  "- free_instruction（任意）: ユーザーからの追加指示（自由記述）",
  "- options（任意）: 拡張用の真偽フラグ（例: 技術用語解説の付加など）"
];

/**
 * `value` と `free_instruction` をモデルが解釈しやすくするための指示（JSON の隣に載せる）。
 */
const CONVERTER_VALUE_APPLICATION_LINES: readonly string[] = [
  "converter_config の value / free_instruction の扱い（リライトに反映すること）:",
  "- few-shot を手本とする度合いは value に合わせる",
  "- free_instruction に非空の文字列があるときは、他の軸と矛盾しない範囲で最優先に従う。"
];

/**
 * 記事本文のリライトを行うLLMクライアントの抽象インターフェース。
 */
interface LlmClient {
  /**
   * 設定に基づいてMarkdown本文をリライトする。
   * @param inputMarkdown 元本文
   * @param converterConfig 変換設定
   * @param slug 記事スラッグ
   * @returns 変換後本文
   */
  rewrite(inputMarkdown: string, converterConfig: ConverterConfig, slug: string): Promise<string>;
}

/**
 * Ollamaを利用するLLMクライアント実装。
 */
class OllamaClient implements LlmClient {
  /**
   * @param runtimeConfig 実行時設定
   * @param systemPrompt システムプロンプト
   */
  public constructor(private readonly runtimeConfig: RuntimeConfig, private readonly systemPrompt: string) {}

  /**
   * Ollama APIを呼び出して本文をリライトする。
   * @param inputMarkdown 元本文
   * @param converterConfig 変換設定
   * @param slug 記事スラッグ
   * @returns 変換後本文
   * @throws {Error} APIレスポンスが不正な場合
   */
  public async rewrite(inputMarkdown: string, converterConfig: ConverterConfig, slug: string): Promise<string> {
    const body = {
      model: this.runtimeConfig.ollamaModel,
      stream: false,
      options: {
        temperature: INFERENCE_TEMPERATURE,
        num_predict: OLLAMA_NUM_PREDICT
      },
      messages: [
        { role: "system", content: this.systemPrompt },
        {
          role: "user",
          content: buildUserPrompt(inputMarkdown, converterConfig, slug)
        }
      ]
    };
    const response = await fetch(`${this.runtimeConfig.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as { message?: { content?: string } };
    const content = data.message?.content?.trim();
    if (!content) {
      throw new Error("Ollama returned empty response.");
    }
    return content;
  }
}

/**
 * OpenAIを利用するLLMクライアント実装。
 */
class OpenAiClient implements LlmClient {
  private readonly client: OpenAI;

  /**
   * @param runtimeConfig 実行時設定
   * @param systemPrompt システムプロンプト
   */
  public constructor(private readonly runtimeConfig: RuntimeConfig, private readonly systemPrompt: string) {
    this.client = new OpenAI({ apiKey: runtimeConfig.openAiApiKey });
  }

  /**
   * OpenAI APIを呼び出して本文をリライトする。
   * @param inputMarkdown 元本文
   * @param converterConfig 変換設定
   * @param slug 記事スラッグ
   * @returns 変換後本文
   * @throws {Error} APIレスポンスが空の場合
   */
  public async rewrite(inputMarkdown: string, converterConfig: ConverterConfig, slug: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.runtimeConfig.openAiModel,
      temperature: INFERENCE_TEMPERATURE,
      messages: [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: buildUserPrompt(inputMarkdown, converterConfig, slug) }
      ]
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenAI returned empty response.");
    }
    return content;
  }
}

/**
 * LLMへ渡すユーザープロンプトを構築する。
 * @param markdown 元本文
 * @param converterConfig 変換設定
 * @param slug 記事スラッグ
 * @returns プロンプト文字列
 */
const buildUserPrompt = (markdown: string, converterConfig: ConverterConfig, slug: string): string => {
  /**
   * 軸ごとに value と few-shot を並べ、参照の強さを数値に連動させて説明する（閾値は使わない）。
   */
  const buildFewShotLines = (label: string, setting: ParameterSetting): string[] => {
    const valueText: string = setting.value.toFixed(2);
    const header: string = `- ${label}: この軸の value=${valueText} が、下の入出力ペアを「手本としてどれだけ参考にするか」の度合い。高いほど例の語感・言い換え方針に寄せ、低いほど例は弱いヒントに留め原文の表現を優先する。`;
    const examples: FewShotExample[] | undefined = setting.example;
    if (!examples || examples.length === 0) {
      return [`- ${label}: (none)`];
    }
    const lines: string[] = [`- ${label}:`];
    for (const [index, example] of examples.entries()) {
      lines.push(`  - example_${index + 1}.input: ${example.input}`);
      lines.push(`  - example_${index + 1}.output: ${example.output}`);
    }
    return lines;
  };

  const fewShotSection: string[] = [
    "few_shot_examples（各ブロック先頭の value が、その軸の例の参考度。連続的に解釈）:",
    ...buildFewShotLines("logical_density", converterConfig.logical_density),
    ...buildFewShotLines("technical_focus", converterConfig.technical_focus),
    ...buildFewShotLines("emotional_retention", converterConfig.emotional_retention),
    ...buildFewShotLines("politeness_level", converterConfig.politeness_level)
  ];

  return [
    `slug: ${slug}`,
    ...CONVERTER_CONFIG_PARAMETER_LEGEND_LINES,
    ...CONVERTER_VALUE_APPLICATION_LINES,
    `converter_config: ${JSON.stringify(converterConfig, null, 2)}`,
    ...fewShotSection,
    "task:",
    "- Rewrite the article based on system_prompt constraints and converter_config.",
    "",
    "article:",
    markdown
  ].join("\n");
};

/**
 * 環境設定に応じたLLMクライアントを生成する。
 * @param runtimeConfig 実行時設定
 * @returns LLMクライアント
 */
export const createLlmClient = async (runtimeConfig: RuntimeConfig): Promise<LlmClient> => {
  const systemPrompt = await fs.readFile(promptPath, "utf-8");
  if (runtimeConfig.llmProvider === "ollama") {
    return new OllamaClient(runtimeConfig, systemPrompt);
  }
  return new OpenAiClient(runtimeConfig, systemPrompt);
};
