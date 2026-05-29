import * as vscode from "vscode";
import {
  SECRET_GIT_AUTHOR_EMAIL,
  SECRET_GIT_AUTHOR_NAME,
  SECRET_GITHUB_TOKEN,
  SECRET_OPENAI_API_KEY,
  runConversionWithProgress,
  storeSecret
} from "./note2zennController.js";
import { Note2ZennSidebarProvider } from "./sidebarViewProvider.js";

let sidebarProvider: Note2ZennSidebarProvider | undefined;

const promptRequired = async (prompt: string): Promise<string | undefined> => {
  const value = await vscode.window.showInputBox({
    prompt,
    ignoreFocusOut: true,
    validateInput: (input: string) => (input.trim().length === 0 ? "Required." : undefined)
  });
  return value?.trim() || undefined;
};

export const activate = (context: vscode.ExtensionContext): void => {
  sidebarProvider = new Note2ZennSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(Note2ZennSidebarProvider.viewType, sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  const register = (command: string, handler: (...args: unknown[]) => Promise<void>): void => {
    context.subscriptions.push(vscode.commands.registerCommand(command, handler));
  };

  register("note2zenn.focusSidebar", async () => {
    sidebarProvider?.focus();
  });

  register("note2zenn.setOpenAiApiKey", async () => {
    if (await storeSecret(context, SECRET_OPENAI_API_KEY, "OpenAI API key", true)) {
      await sidebarProvider?.refresh();
    }
  });

  register("note2zenn.setGithubToken", async () => {
    if (await storeSecret(context, SECRET_GITHUB_TOKEN, "GitHub token", true)) {
      await sidebarProvider?.refresh();
    }
  });

  register("note2zenn.setGitAuthorName", async () => {
    if (await storeSecret(context, SECRET_GIT_AUTHOR_NAME, "Git author name")) {
      await sidebarProvider?.refresh();
    }
  });

  register("note2zenn.setGitAuthorEmail", async () => {
    if (await storeSecret(context, SECRET_GIT_AUTHOR_EMAIL, "Git author email")) {
      await sidebarProvider?.refresh();
    }
  });

  register("note2zenn.openSettings", async () => {
    await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:hanaviye.note2zenn-hanaviye");
  });

  register("note2zenn.runConversion", async () => {
    const noteUrl = await promptRequired("note URL (https://note.com/...)");
    if (!noteUrl) {
      return;
    }
    const basename = await promptRequired("Save file basename");
    if (!basename) {
      return;
    }
    await runConversionWithProgress(context, { noteUrl, basename });
    await sidebarProvider?.refresh();
  });
};

export const deactivate = (): void => {
  sidebarProvider = undefined;
};
