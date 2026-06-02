/**
 * サイドバー Webview 用 HTML の読み込みと CSP / スクリプト URI の差し込み。
 */
import fs from "node:fs/promises";
import * as vscode from "vscode";

export const loadSidebarHtml = async (
  extensionUri: vscode.Uri,
  webview: vscode.Webview
): Promise<string> => {
  const htmlUri = vscode.Uri.joinPath(extensionUri, "media", "sidebar.html");
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "sidebar.js"));

  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource}`
  ].join("; ");

  const template = await fs.readFile(htmlUri.fsPath, "utf-8");
  return template.replace("__CSP__", csp).replace("__SCRIPT_URI__", scriptUri.toString());
};
