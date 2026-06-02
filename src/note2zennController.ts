/**
 * 拡張 UI と変換パイプラインの橋渡し。
 *
 * - VSCode 設定（note2zenn.*）の読み書き
 * - SecretStorage（API キー・Git 情報）の読み書き
 * - 変換実行前の入力検証とログ出力
 */
import * as vscode from "vscode";
import { runConversion } from "./pipeline.js";

// SecretStorage に保存するキー名
export const SECRET_OPENAI_API_KEY = "note2zenn.openaiApiKey" as const;
export const SECRET_GITHUB_TOKEN = "note2zenn.githubToken" as const;
export const SECRET_GIT_AUTHOR_NAME = "note2zenn.gitAuthorName" as const;
export const SECRET_GIT_AUTHOR_EMAIL = "note2zenn.gitAuthorEmail" as const;

const EXTENSION_CONFIG_KEY = "note2zenn" as const;

let outputChannel: vscode.OutputChannel | undefined;

export const getOutputChannel = (): vscode.OutputChannel => {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Note2Zenn");
  }
  return outputChannel;
};

export const logLine = (message: string): void => {
  getOutputChannel().appendLine(message);
  console.log(message);
};

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

const getConfig = (): vscode.WorkspaceConfiguration =>
  vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY);

export interface Note2ZennSettings {
  zennRepoPath: string;
  openAiModel: string;
  defaultAnalysisBasename: string;
  converterConfig: unknown;
}

export interface SecretStatus {
  openAiApiKey: boolean;
  githubToken: boolean;
  gitAuthorName: boolean;
  gitAuthorEmail: boolean;
}

// --- VSCode 設定（非秘密） ---

export const readSettings = (): Note2ZennSettings => {
  const config = getConfig();
  return {
    zennRepoPath: String(config.get("zennRepoPath", "")).trim(),
    openAiModel: String(config.get("openAiModel", "gpt-4.1-mini")).trim(),
    defaultAnalysisBasename: String(config.get("defaultAnalysisBasename", "")).trim(),
    converterConfig: config.get("converterConfig", {})
  };
};

export const saveSettings = async (settings: Note2ZennSettings): Promise<void> => {
  const config = getConfig();
  await config.update("zennRepoPath", settings.zennRepoPath, vscode.ConfigurationTarget.Global);
  await config.update("openAiModel", settings.openAiModel, vscode.ConfigurationTarget.Global);
  await config.update(
    "defaultAnalysisBasename",
    settings.defaultAnalysisBasename,
    vscode.ConfigurationTarget.Global
  );
  await config.update("converterConfig", settings.converterConfig, vscode.ConfigurationTarget.Global);
};

// --- SecretStorage（秘密情報） ---

export const readSecretStatus = async (context: vscode.ExtensionContext): Promise<SecretStatus> => {
  const [openAiApiKey, githubToken, gitAuthorName, gitAuthorEmail] = await Promise.all([
    context.secrets.get(SECRET_OPENAI_API_KEY),
    context.secrets.get(SECRET_GITHUB_TOKEN),
    context.secrets.get(SECRET_GIT_AUTHOR_NAME),
    context.secrets.get(SECRET_GIT_AUTHOR_EMAIL)
  ]);
  return {
    openAiApiKey: Boolean(openAiApiKey?.trim()),
    githubToken: Boolean(githubToken?.trim()),
    gitAuthorName: Boolean(gitAuthorName?.trim()),
    gitAuthorEmail: Boolean(gitAuthorEmail?.trim())
  };
};

const SECRET_LABELS: Readonly<Record<keyof SecretStatus, string>> = {
  openAiApiKey: "OpenAI API Key",
  githubToken: "GitHub Token",
  gitAuthorName: "Git Author Name",
  gitAuthorEmail: "Git Author Email"
};

/** いずれかの Secret が未設定のときメッセージを返す。すべて設定済みなら undefined。 */
export const getSecretsValidationError = (secrets: SecretStatus): string | undefined => {
  const missing = (Object.keys(SECRET_LABELS) as (keyof SecretStatus)[])
    .filter((key) => !secrets[key])
    .map((key) => SECRET_LABELS[key]);
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

const promptInput = async (prompt: string, password = false): Promise<string | undefined> => {
  const value = await vscode.window.showInputBox({
    prompt,
    ignoreFocusOut: true,
    password,
    validateInput: (input: string) => (input.trim().length === 0 ? "Required." : undefined)
  });
  return value?.trim() || undefined;
};

export const storeSecret = async (
  context: vscode.ExtensionContext,
  key: string,
  prompt: string,
  password = false
): Promise<boolean> => {
  const value = await promptInput(prompt, password);
  if (!value) {
    return false;
  }
  await context.secrets.store(key, value);
  vscode.window.showInformationMessage("Saved.");
  return true;
};

// --- 変換実行 ---

export interface RunConversionParams {
  noteUrl: string;
  basename?: string;
}

export const executeConversion = async (
  context: vscode.ExtensionContext,
  params: RunConversionParams
): Promise<string> => {
  const noteUrl = params.noteUrl.trim();
  const basenameInput = params.basename?.trim() ?? "";
  validateNoteUrl(noteUrl);

  // 設定と Secret を集約
  const settings = readSettings();
  const analysisBasename = basenameInput || settings.defaultAnalysisBasename || undefined;

  const secretStatus = await readSecretStatus(context);
  const secretsError = getSecretsValidationError(secretStatus);
  if (secretsError) {
    throw new Error(secretsError);
  }

  const openAiApiKey = (await context.secrets.get(SECRET_OPENAI_API_KEY)) ?? "";
  const githubToken = (await context.secrets.get(SECRET_GITHUB_TOKEN)) ?? "";
  const gitAuthorName = (await context.secrets.get(SECRET_GIT_AUTHOR_NAME)) ?? "";
  const gitAuthorEmail = (await context.secrets.get(SECRET_GIT_AUTHOR_EMAIL)) ?? "";

  if (!settings.zennRepoPath) {
    throw new Error("note2zenn.zennRepoPath is not configured.");
  }
  if (!analysisBasename) {
    throw new Error("basename is required.");
  }

  getOutputChannel().clear();
  logLine("[note2zenn] Run Conversion started");
  logLine(`[note2zenn] noteUrl=${noteUrl}`);
  logLine(`[note2zenn] basename=${analysisBasename}`);

  const articlePath = await runConversion({
    noteUrl,
    analysisMarkdownBasename: analysisBasename,
    runtimeConfig: {
      zennRepoPath: settings.zennRepoPath,
      openAiApiKey,
      openAiModel: settings.openAiModel,
      gitAuthorName,
      gitAuthorEmail,
      githubToken
    },
    converterConfig: settings.converterConfig
  });

  logLine(`[note2zenn] done: ${articlePath}`);
  return articlePath;
};

/** 通知付きプログレスバーで変換を実行し、失敗時は Output とエラー通知を出す。 */
export const runConversionWithProgress = async (
  context: vscode.ExtensionContext,
  params: RunConversionParams
): Promise<void> => {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "note2zenn: converting note article",
        cancellable: false
      },
      async () => {
        const articlePath = await executeConversion(context, params);
        getOutputChannel().show(true);
        vscode.window.showInformationMessage(`note2zenn done: ${articlePath}`);
      }
    );
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    logLine(`[note2zenn] failed: ${message}`);
    getOutputChannel().show(true);
    vscode.window.showErrorMessage(`note2zenn failed: ${message}`);
    throw error;
  }
};
