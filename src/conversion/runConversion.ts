/**
 * 変換パイプラインの実行（UI からの入口）。
 */
import * as vscode from "vscode";
import { runConversion } from "../pipeline.js";
import { getOutputChannel, logLine, toErrorMessage } from "../output/outputChannel.js";
import { readSecretsForConversion } from "../settings/secrets.js";
import { readSettings } from "../settings/workspaceSettings.js";
import { validateRunConversionInput } from "../validation/conversionInput.js";

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

  const validationError = await validateRunConversionInput(context, noteUrl, basenameInput);
  if (validationError) {
    throw new Error(validationError);
  }

  const settings = readSettings();
  const analysisBasename = basenameInput || settings.defaultAnalysisBasename;
  const { openAiApiKey, githubToken, gitAuthorName, gitAuthorEmail } =
    await readSecretsForConversion(context);

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
