/**
 * Zenn リポへの git commit / push（Publish ステップ）。
 *
 * articles/<basename>.md と images/<assetDir>/ を stage し、
 * 差分がなければスキップ。GitHub Token がある場合は HTTPS push に埋め込む。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ParsedArticle } from "../types/article.js";

const execFileAsync = promisify(execFile);

type ExecFileError = Error & { stderr?: string };

/** 権限・所有権エラー時に zennRepoPath の確認を促すメッセージを付与 */
const rethrowGitError = (repoPath: string, error: unknown): never => {
  const execError = error as ExecFileError;
  const detail = `${execError.stderr ?? ""}${execError.message ?? ""}`.trim();
  const needsPermissionHint =
    detail.includes("insufficient permission") ||
    detail.includes("dubious ownership") ||
    detail.includes("failed to insert into database");

  if (needsPermissionHint) {
    throw new Error(
      [
        `Git failed in ${repoPath}: ${detail}`,
        "Check repository ownership and write permission under note2zenn.zennRepoPath."
      ].join("\n")
    );
  }

  throw error;
};

/** 拡張ホストから別ユーザ所有のリポを触るときの safe.directory 設定 */
const gitArgsWithSafeDirectory = (repoPath: string, args: string[]): string[] => {
  return ["-c", `safe.directory=${repoPath}`, ...args];
};

const runGit = async (repoPath: string, args: string[]): Promise<void> => {
  try {
    await execFileAsync("git", gitArgsWithSafeDirectory(repoPath, args), { cwd: repoPath });
  } catch (error: unknown) {
    return rethrowGitError(repoPath, error);
  }
};

const runGitWithStdout = async (repoPath: string, args: string[]): Promise<string> => {
  try {
    const result = await execFileAsync("git", gitArgsWithSafeDirectory(repoPath, args), { cwd: repoPath });
    return result.stdout.trim();
  } catch (error: unknown) {
    return rethrowGitError(repoPath, error);
  }
};

/** x-access-token 形式で HTTPS リモート URL にトークンを埋め込む */
const buildAuthenticatedRemoteUrl = (remoteUrl: string, githubToken: string): string => {
  const url = new URL(remoteUrl);
  url.username = "x-access-token";
  url.password = githubToken;
  return url.toString();
};

export const publishToZennRepo = async (
  article: ParsedArticle,
  zennRepoPath: string,
  articleFileBasename: string,
  gitOptions?: {
    gitAuthorName?: string;
    gitAuthorEmail?: string;
    githubToken?: string;
  }
): Promise<void> => {
  const articlePath = `articles/${articleFileBasename}.md`;
  const imagePath = `images/${article.assetDir}`;
  const commitMessage = `add ${articleFileBasename}`;
  const commitUserName = gitOptions?.gitAuthorName ?? "note2zenn-bot";
  const commitUserEmail = gitOptions?.gitAuthorEmail ?? "note2zenn-bot@example.local";
  const githubToken = gitOptions?.githubToken;

  await runGit(zennRepoPath, ["add", "--", articlePath, imagePath]);

  // staged 差分がなければ commit / push しない
  try {
    await runGit(zennRepoPath, ["diff", "--cached", "--quiet"]);
    console.log(`[INFO] No changes to publish for ${article.slug}.`);
    return;
  } catch {
    // diff --quiet は差分があると非ゼロ終了する（正常）
  }

  await runGit(zennRepoPath, [
    "-c",
    `user.name=${commitUserName}`,
    "-c",
    `user.email=${commitUserEmail}`,
    "commit",
    "-m",
    commitMessage
  ]);

  // Token 未設定、または SSH リモートの場合は通常 push
  if (!githubToken) {
    await runGit(zennRepoPath, ["push"]);
    return;
  }

  const remoteUrl = await runGitWithStdout(zennRepoPath, ["remote", "get-url", "origin"]);
  if (!remoteUrl.startsWith("https://")) {
    await runGit(zennRepoPath, ["push"]);
    return;
  }

  // HTTPS + Token: 認証 URL を一時的に push 先に指定
  const currentBranch = await runGitWithStdout(zennRepoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const authenticatedRemoteUrl = buildAuthenticatedRemoteUrl(remoteUrl, githubToken);
  await runGit(zennRepoPath, ["push", authenticatedRemoteUrl, `HEAD:${currentBranch}`]);
};
