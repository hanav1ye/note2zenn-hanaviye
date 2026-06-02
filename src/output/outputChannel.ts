/**
 * Note2Zenn 用 Output チャンネルとログ出力。
 */
import * as vscode from "vscode";

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
