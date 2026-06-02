/**
 * VSCode ワークスペース設定（note2zenn.*）の読み書き。
 */
import * as vscode from "vscode";

const EXTENSION_CONFIG_KEY = "note2zenn" as const;

const getConfig = (): vscode.WorkspaceConfiguration =>
  vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY);

export interface Note2ZennSettings {
  zennRepoPath: string;
  openAiModel: string;
  defaultAnalysisBasename: string;
  converterConfig: unknown;
}

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
