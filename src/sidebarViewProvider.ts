import * as vscode from "vscode";
import {
  Note2ZennSettings,
  SecretStatus,
  SECRET_GIT_AUTHOR_EMAIL,
  SECRET_GIT_AUTHOR_NAME,
  SECRET_GITHUB_TOKEN,
  SECRET_OPENAI_API_KEY,
  readSecretStatus,
  readSettings,
  runConversionWithProgress,
  saveSettings,
  storeSecret
} from "./note2zennController.js";

type WebviewInboundMessage =
  | { type: "ready" }
  | { type: "run"; noteUrl: string; basename: string }
  | { type: "saveSettings"; settings: Note2ZennSettings }
  | { type: "setSecret"; secret: "openAiApiKey" | "githubToken" | "gitAuthorName" | "gitAuthorEmail" }
  | { type: "openSettings" };

type WebviewOutboundMessage =
  | { type: "state"; settings: Note2ZennSettings; secrets: SecretStatus }
  | { type: "log"; message: string };

export class Note2ZennSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "note2zenn.sidebar";

  private view?: vscode.WebviewView;

  public constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    webviewView.webview.html = this.buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (raw: WebviewInboundMessage) => {
      try {
        await this.handleMessage(raw);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        void vscode.window.showErrorMessage(`note2zenn: ${message}`);
        await this.postState();
      }
    });

    void this.postState();
  }

  public async refresh(): Promise<void> {
    await this.postState();
  }

  public focus(): void {
    if (this.view) {
      this.view.show(true);
      return;
    }
    void vscode.commands.executeCommand(`${Note2ZennSidebarProvider.viewType}.focus`);
  }

  private async postState(): Promise<void> {
    if (!this.view) {
      return;
    }
    const payload: WebviewOutboundMessage = {
      type: "state",
      settings: readSettings(),
      secrets: await readSecretStatus(this.context)
    };
    await this.view.webview.postMessage(payload);
  }

  private postLog(message: string): void {
    if (!this.view) {
      return;
    }
    const payload: WebviewOutboundMessage = { type: "log", message };
    void this.view.webview.postMessage(payload);
  }

  private async handleMessage(message: WebviewInboundMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.postState();
        return;
      case "saveSettings":
        await saveSettings(message.settings);
        vscode.window.showInformationMessage("Settings saved.");
        await this.postState();
        return;
      case "setSecret": {
        const saved = await this.storeSecretByKind(message.secret);
        if (saved) {
          await this.postState();
        }
        return;
      }
      case "openSettings":
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "@ext:hanaviye.note2zenn-hanaviye"
        );
        return;
      case "run":
        this.postLog("変換を開始します…");
        await runConversionWithProgress(this.context, {
          noteUrl: message.noteUrl,
          basename: message.basename
        });
        this.postLog("変換が完了しました。");
        await this.postState();
        return;
      default:
        return;
    }
  }

  private async storeSecretByKind(
    secret: "openAiApiKey" | "githubToken" | "gitAuthorName" | "gitAuthorEmail"
  ): Promise<boolean> {
    switch (secret) {
      case "openAiApiKey":
        return storeSecret(this.context, SECRET_OPENAI_API_KEY, "OpenAI API key", true);
      case "githubToken":
        return storeSecret(this.context, SECRET_GITHUB_TOKEN, "GitHub token", true);
      case "gitAuthorName":
        return storeSecret(this.context, SECRET_GIT_AUTHOR_NAME, "Git author name");
      case "gitAuthorEmail":
        return storeSecret(this.context, SECRET_GIT_AUTHOR_EMAIL, "Git author email");
      default:
        return false;
    }
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = String(Date.now());
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 12px;
      line-height: 1.4;
    }
    h2 {
      font-size: 1em;
      margin: 16px 0 8px;
      font-weight: 600;
    }
    h2:first-child { margin-top: 0; }
    label {
      display: block;
      margin: 8px 0 4px;
      font-size: 0.9em;
      opacity: 0.9;
    }
    input, textarea {
      width: 100%;
      box-sizing: border-box;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      padding: 6px 8px;
      border-radius: 2px;
    }
    textarea { min-height: 120px; font-family: var(--vscode-editor-font-family); font-size: 0.85em; }
    button {
      margin-top: 8px;
      width: 100%;
      padding: 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button:disabled { opacity: 0.5; cursor: default; }
    .row { display: flex; gap: 6px; }
    .row button { flex: 1; }
    .status { font-size: 0.85em; margin: 4px 0 8px; }
    .ok { color: var(--vscode-testing-iconPassed, #89d185); }
    .ng { color: var(--vscode-errorForeground); }
    #log {
      margin-top: 12px;
      padding: 8px;
      background: var(--vscode-textCodeBlock-background);
      font-size: 0.8em;
      white-space: pre-wrap;
      min-height: 2em;
    }
  </style>
</head>
<body>
  <h2>変換</h2>
  <label for="noteUrl">note URL</label>
  <input id="noteUrl" type="url" placeholder="https://note.com/..." />
  <label for="basename">basename</label>
  <input id="basename" type="text" placeholder="articles/images のベース名" />
  <button id="runBtn">変換を実行</button>

  <h2>設定</h2>
  <label for="zennRepoPath">Zenn リポジトリパス</label>
  <input id="zennRepoPath" type="text" />
  <label for="openAiModel">OpenAI モデル</label>
  <input id="openAiModel" type="text" />
  <label for="defaultBasename">既定 basename（任意）</label>
  <input id="defaultBasename" type="text" />
  <label for="converterConfig">converterConfig（JSON）</label>
  <textarea id="converterConfig"></textarea>
  <button id="saveSettingsBtn" class="secondary">設定を保存</button>
  <button id="openSettingsBtn" class="secondary">詳細設定を開く</button>

  <h2>秘密情報</h2>
  <div class="status" id="secretOpenAi"></div>
  <div class="status" id="secretGithub"></div>
  <div class="status" id="secretGitName"></div>
  <div class="status" id="secretGitEmail"></div>
  <div class="row">
    <button class="secondary" data-secret="openAiApiKey">OpenAI Key</button>
    <button class="secondary" data-secret="githubToken">GitHub Token</button>
  </div>
  <div class="row">
    <button class="secondary" data-secret="gitAuthorName">Git 名前</button>
    <button class="secondary" data-secret="gitAuthorEmail">Git メール</button>
  </div>

  <div id="log"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const $ = (id) => document.getElementById(id);

    const setSecretStatus = (el, label, ok) => {
      el.textContent = label + (ok ? "：設定済み" : "：未設定");
      el.className = "status " + (ok ? "ok" : "ng");
    };

    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (msg.type === "state") {
        $("zennRepoPath").value = msg.settings.zennRepoPath || "";
        $("openAiModel").value = msg.settings.openAiModel || "";
        $("defaultBasename").value = msg.settings.defaultAnalysisBasename || "";
        $("converterConfig").value = JSON.stringify(msg.settings.converterConfig || {}, null, 2);
        if (! $("basename").value && msg.settings.defaultAnalysisBasename) {
          $("basename").value = msg.settings.defaultAnalysisBasename;
        }
        setSecretStatus($("secretOpenAi"), "OpenAI API Key", msg.secrets.openAiApiKey);
        setSecretStatus($("secretGithub"), "GitHub Token", msg.secrets.githubToken);
        setSecretStatus($("secretGitName"), "Git Author Name", msg.secrets.gitAuthorName);
        setSecretStatus($("secretGitEmail"), "Git Author Email", msg.secrets.gitAuthorEmail);
      }
      if (msg.type === "log") {
        $("log").textContent = msg.message;
      }
    });

    $("runBtn").addEventListener("click", () => {
      vscode.postMessage({
        type: "run",
        noteUrl: $("noteUrl").value.trim(),
        basename: $("basename").value.trim()
      });
    });

    $("saveSettingsBtn").addEventListener("click", () => {
      let converterConfig = {};
      try {
        converterConfig = JSON.parse($("converterConfig").value || "{}");
      } catch {
        $("log").textContent = "converterConfig の JSON が不正です。";
        return;
      }
      vscode.postMessage({
        type: "saveSettings",
        settings: {
          zennRepoPath: $("zennRepoPath").value.trim(),
          openAiModel: $("openAiModel").value.trim(),
          defaultAnalysisBasename: $("defaultBasename").value.trim(),
          converterConfig
        }
      });
    });

    $("openSettingsBtn").addEventListener("click", () => {
      vscode.postMessage({ type: "openSettings" });
    });

    document.querySelectorAll("[data-secret]").forEach((btn) => {
      btn.addEventListener("click", () => {
        vscode.postMessage({ type: "setSecret", secret: btn.getAttribute("data-secret") });
      });
    });

    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
  }
}
