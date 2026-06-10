/**
 * Activity Bar サイドバーの Webview UI。
 *
 * HTML / JS は media/sidebar.html と media/sidebar.js。
 * 検証は validation/conversionInput.ts に集約し、ホスト側でのみ実行する。
 */
import * as vscode from "vscode";
import { runConversionWithProgress } from "./conversion/runConversion.js";
import {
  SECRET_GIT_AUTHOR_EMAIL,
  SECRET_GIT_AUTHOR_NAME,
  SECRET_GITHUB_TOKEN,
  SECRET_OPENAI_API_KEY,
  readSecretStatus,
  storeSecret,
  type SecretStatus
} from "./settings/secrets.js";
import { readSettings, saveSettings, type Note2ZennSettings } from "./settings/workspaceSettings.js";
import {
  buildConverterConfigFromForm,
  readConverterFormValues,
  type ConverterFormValues
} from "./settings/converterConfigForm.js";
import { areAllSecretsConfigured, getSecretsValidationError } from "./validation/conversionInput.js";
import { loadSidebarHtml } from "./webview/loadSidebarHtml.js";

/** Webview → 拡張ホストへ送るメッセージ種別 */
type WebviewInboundMessage =
  | { type: "ready" }
  | {
      type: "run";
      noteUrl: string;
      basename: string;
      settingsDraft: {
        zennRepoPath: string;
        openAiModel: string;
        defaultAnalysisBasename: string;
        converter: ConverterFormValues;
      };
    }
  | { type: "setSecret"; secret: "openAiApiKey" | "githubToken" | "gitAuthorName" | "gitAuthorEmail" };

/** 拡張ホスト → Webview へ送るメッセージ種別 */
type WebviewOutboundMessage =
  | {
      type: "state";
      settings: Note2ZennSettings;
      converterForm: ConverterFormValues;
      secrets: SecretStatus;
      canRun: boolean;
      secretsError: string;
    }
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
    void this.setWebviewHtml(webviewView.webview);

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

  private async setWebviewHtml(webview: vscode.Webview): Promise<void> {
    webview.html = await loadSidebarHtml(this.context.extensionUri, webview);
  }

  private async postState(): Promise<void> {
    if (!this.view) {
      return;
    }
    const secrets = await readSecretStatus(this.context);
    const secretsError = getSecretsValidationError(secrets) ?? "";
    const settings = readSettings();
    const payload: WebviewOutboundMessage = {
      type: "state",
      settings,
      converterForm: readConverterFormValues(settings.converterConfig),
      secrets,
      canRun: areAllSecretsConfigured(secrets),
      secretsError
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
      case "setSecret": {
        const saved = await this.storeSecretByKind(message.secret);
        if (saved) {
          await this.postState();
        }
        return;
      }
      case "run": {
        this.postLog("変換を開始します…");
        try {
          await saveSettings({
            zennRepoPath: message.settingsDraft.zennRepoPath,
            openAiModel: message.settingsDraft.openAiModel,
            defaultAnalysisBasename: message.settingsDraft.defaultAnalysisBasename,
            converterConfig: buildConverterConfigFromForm(message.settingsDraft.converter)
          });
          await runConversionWithProgress(this.context, {
            noteUrl: message.noteUrl,
            basename: message.basename
          });
          this.postLog("変換が完了しました。");
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          this.postLog(msg);
        }
        await this.postState();
        return;
      }
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
}
