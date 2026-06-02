/**
 * OpenAI API による本文リライト（Inference ステップ）。
 *
 * prompts/system_prompt.txt を system メッセージに、
 * converterConfig と few-shot 例を user メッセージに載せて Chat Completions を呼ぶ。
 */
import fs from "node:fs/promises";
import OpenAI from "openai";
import { ConverterConfig, FewShotExample, ParameterSetting, RuntimeConfig } from "../types/config.js";
import { promptPath } from "../utils/paths.js";

/** 変換再現性のため temperature は 0 固定 */
const INFERENCE_TEMPERATURE = 0 as const;

/** user プロンプトに載せる converter_config 各キーの説明文 */
const CONVERTER_CONFIG_PARAMETER_LEGEND_LINES: readonly string[] = [
  "converter_config の各キーの意味（各軸の value は強度 0.0〜1.0）:",
  "- logical_density: 論理的・結論優先の度合い",
  "- technical_focus: 技術用語やコード解説の度合い",
  "- emotional_retention: 筆者の感想や情緒的表現の度合い",
  "- politeness_level: 丁寧語（です・ます）を強制する度合い",
  "- free_instruction（任意）: ユーザーからの追加指示（自由記述）",
  "- options（任意）: 拡張用の真偽フラグ（例: 技術用語解説の付加など）"
];

/** value / free_instruction の解釈ルール（JSON の隣に載せる） */
const CONVERTER_VALUE_APPLICATION_LINES: readonly string[] = [
  "converter_config の value / free_instruction の扱い（リライトに反映すること）:",
  "- few-shot を手本とする度合いは value に合わせる",
  "- free_instruction に非空の文字列があるときは、他の軸と矛盾しない範囲で最優先に従う。"
];

export interface LlmClient {
  rewrite(inputMarkdown: string, converterConfig: ConverterConfig, slug: string): Promise<string>;
}

class OpenAiClient implements LlmClient {
  private readonly client: OpenAI;

  public constructor(private readonly runtimeConfig: RuntimeConfig, private readonly systemPrompt: string) {
    this.client = new OpenAI({ apiKey: runtimeConfig.openAiApiKey });
  }

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

/** converterConfig と few-shot を含む user プロンプトを組み立てる */
const buildUserPrompt = (markdown: string, converterConfig: ConverterConfig, slug: string): string => {
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

/** system prompt を読み込み OpenAI クライアントを生成する */
export const createLlmClient = async (runtimeConfig: RuntimeConfig): Promise<LlmClient> => {
  const systemPrompt = await fs.readFile(promptPath, "utf-8");
  return new OpenAiClient(runtimeConfig, systemPrompt);
};
