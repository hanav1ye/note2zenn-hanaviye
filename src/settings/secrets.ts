/**
 * SecretStorage（OpenAI / Git 認証情報）の読み書き。
 */
import * as vscode from "vscode";

export const SECRET_OPENAI_API_KEY = "note2zenn.openaiApiKey" as const;
export const SECRET_GITHUB_TOKEN = "note2zenn.githubToken" as const;
export const SECRET_GIT_AUTHOR_NAME = "note2zenn.gitAuthorName" as const;
export const SECRET_GIT_AUTHOR_EMAIL = "note2zenn.gitAuthorEmail" as const;

export interface SecretStatus {
  openAiApiKey: boolean;
  githubToken: boolean;
  gitAuthorName: boolean;
  gitAuthorEmail: boolean;
}

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

export const readSecretsForConversion = async (
  context: vscode.ExtensionContext
): Promise<{
  openAiApiKey: string;
  githubToken: string;
  gitAuthorName: string;
  gitAuthorEmail: string;
}> => ({
  openAiApiKey: (await context.secrets.get(SECRET_OPENAI_API_KEY)) ?? "",
  githubToken: (await context.secrets.get(SECRET_GITHUB_TOKEN)) ?? "",
  gitAuthorName: (await context.secrets.get(SECRET_GIT_AUTHOR_NAME)) ?? "",
  gitAuthorEmail: (await context.secrets.get(SECRET_GIT_AUTHOR_EMAIL)) ?? ""
});
