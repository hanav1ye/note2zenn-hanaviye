/**
 * サイドバー UI 用の converterConfig 組み立て・読み取り。
 */
import type { ConverterConfig } from "../types/config.js";

export const CONVERTER_AXIS_KEYS = [
  "logical_density",
  "technical_focus",
  "emotional_retention",
  "politeness_level"
] as const;

export type ConverterAxisKey = (typeof CONVERTER_AXIS_KEYS)[number];

export const CONVERTER_AXIS_LABELS: Record<ConverterAxisKey, string> = {
  logical_density: "論理密度",
  technical_focus: "技術寄り",
  emotional_retention: "感情・感想",
  politeness_level: "丁寧さ"
};

export const DEFAULT_CONVERTER_AXIS_VALUES: Record<ConverterAxisKey, number> = {
  logical_density: 0.5,
  technical_focus: 0.5,
  emotional_retention: 0.5,
  politeness_level: 0.5
};

export interface ConverterFormValues {
  logical_density: number;
  technical_focus: number;
  emotional_retention: number;
  politeness_level: number;
  free_instruction: string;
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
};

const readAxisValue = (rawConfig: unknown, key: ConverterAxisKey): number => {
  if (!rawConfig || typeof rawConfig !== "object") {
    return DEFAULT_CONVERTER_AXIS_VALUES[key];
  }
  const axis = (rawConfig as Record<string, unknown>)[key];
  if (!axis || typeof axis !== "object") {
    return DEFAULT_CONVERTER_AXIS_VALUES[key];
  }
  const value = (axis as { value?: unknown }).value;
  return clamp01(typeof value === "number" ? value : DEFAULT_CONVERTER_AXIS_VALUES[key]);
};

/** 保存済み設定からサイドバー UI の初期値を作る */
export const readConverterFormValues = (rawConfig: unknown): ConverterFormValues => {
  const rawFree =
    rawConfig && typeof rawConfig === "object"
      ? (rawConfig as ConverterConfig).free_instruction
      : undefined;
  const freeInstruction = typeof rawFree === "string" ? rawFree : "";

  return {
    logical_density: readAxisValue(rawConfig, "logical_density"),
    technical_focus: readAxisValue(rawConfig, "technical_focus"),
    emotional_retention: readAxisValue(rawConfig, "emotional_retention"),
    politeness_level: readAxisValue(rawConfig, "politeness_level"),
    free_instruction: freeInstruction
  };
};

/** サイドバー入力から保存用 converterConfig オブジェクトを組み立てる */
export const buildConverterConfigFromForm = (form: ConverterFormValues): ConverterConfig => {
  return {
    logical_density: { value: clamp01(form.logical_density) },
    technical_focus: { value: clamp01(form.technical_focus) },
    emotional_retention: { value: clamp01(form.emotional_retention) },
    politeness_level: { value: clamp01(form.politeness_level) },
    free_instruction: form.free_instruction.trim()
  };
};
