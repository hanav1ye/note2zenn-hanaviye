/**
 * 変換実行・設定保存前の入力検証（単一の定義元）。
 */
import * as vscode from "vscode";
import { readSettings } from "../settings/workspaceSettings.js";
import { readSecretStatus, type SecretStatus } from "../settings/secrets.js";

const SECRET_FIELDS: readonly { key: keyof SecretStatus; label: string }[] = [
  { key: "openAiApiKey", label: "OpenAI 認証情報" },
  { key: "githubToken", label: "GitHub 認証情報" },
  { key: "gitAuthorName", label: "Git 作者名" },
  { key: "gitAuthorEmail", label: "Git 作者メール" }
];

/** いずれかの Secret が未設定のときメッセージを返す。すべて設定済みなら undefined。 */
export const getSecretsValidationError = (secrets: SecretStatus): string | undefined => {
  const missing = SECRET_FIELDS.filter(({ key }) => !secrets[key]).map(({ label }) => label);
  if (missing.length === 0) {
    return undefined;
  }
  return `次の秘密情報が未設定です: ${missing.join("、")}`;
};

export const areAllSecretsConfigured = (secrets: SecretStatus): boolean =>
  getSecretsValidationError(secrets) === undefined;

/** note URL が不正なときメッセージを返す。問題なければ undefined。 */
export const getNoteUrlValidationError = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "note URL を入力してください。";
  }
  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes("note.com")) {
      return "note.com の記事 URL を指定してください。";
    }
    return undefined;
  } catch {
    return "URL の形式が正しくありません。";
  }
};

export const validateNoteUrl = (value: string): void => {
  const error = getNoteUrlValidationError(value);
  if (error) {
    throw new Error(error);
  }
};

/** converterConfig の JSON 文字列をパースする。 */
export const parseConverterConfigJson = (
  text: string
): { ok: true; value: unknown } | { ok: false; error: string } => {
  try {
    return { ok: true, value: JSON.parse(text || "{}") };
  } catch {
    return { ok: false, error: "converterConfig の JSON が不正です。" };
  }
};

/**
 * 変換開始前の総合検証。問題なければ undefined。
 */
export const validateRunConversionInput = async (
  context: vscode.ExtensionContext,
  noteUrl: string,
  basename?: string
): Promise<string | undefined> => {
  const urlError = getNoteUrlValidationError(noteUrl);
  if (urlError) {
    return urlError;
  }

  const secretsError = getSecretsValidationError(await readSecretStatus(context));
  if (secretsError) {
    return secretsError;
  }

  const settings = readSettings();
  if (!settings.zennRepoPath) {
    return "note2zenn.zennRepoPath is not configured.";
  }

  const analysisBasename = basename?.trim() || settings.defaultAnalysisBasename || undefined;
  if (!analysisBasename) {
    return "basename is required.";
  }

  return undefined;
};
