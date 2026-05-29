import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ParsedArticle } from "../types/article.js";

const execFileAsync = promisify(execFile);

type ExecFileError = Error & { stderr?: string };

/**
 * git 実行失敗時に権限系のヒントを付与する。
 * @param repoPath Zenn リポジトリのルートパス
 * @param error 実行エラー
 */
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

/**
 * Docker 等でホスト所有のリポジトリを操作するときの `safe.directory` 付き git 引数を組み立てる。
 * @param repoPath Zenn リポジトリのルートパス
 * @param args git サブコマンド以降の引数
 * @returns `git` に渡す引数配列
 */
const gitArgsWithSafeDirectory = (repoPath: string, args: string[]): string[] => {
  return ["-c", `safe.directory=${repoPath}`, ...args];
};

/**
 * 指定ディレクトリでgitコマンドを実行する。
 * @param repoPath Zenn リポジトリのルートパス
 * @param args git引数
 */
const runGit = async (repoPath: string, args: string[]): Promise<void> => {
  try {
    await execFileAsync("git", gitArgsWithSafeDirectory(repoPath, args), { cwd: repoPath });
  } catch (error: unknown) {
    return rethrowGitError(repoPath, error);
  }
};

/**
 * 指定ディレクトリでgitコマンドを実行し、標準出力を返す。
 * @param repoPath Zenn リポジトリのルートパス
 * @param args git引数
 * @returns 標準出力
 */
const runGitWithStdout = async (repoPath: string, args: string[]): Promise<string> => {
  try {
    const result = await execFileAsync("git", gitArgsWithSafeDirectory(repoPath, args), { cwd: repoPath });
    return result.stdout.trim();
  } catch (error: unknown) {
    return rethrowGitError(repoPath, error);
  }
};

/**
 * HTTPSリモートURLにトークン認証情報を埋め込む。
 * @param remoteUrl リモートURL
 * @param githubToken GitHubトークン
 * @returns 認証情報付きリモートURL
 */
const buildAuthenticatedRemoteUrl = (remoteUrl: string, githubToken: string): string => {
  const url = new URL(remoteUrl);
  url.username = "x-access-token";
  url.password = githubToken;
  return url.toString();
};

/**
 * Copy後の変更をZennリポジトリへ反映する。
 * @param article 解析済み記事データ
 * @param zennRepoPath Zennリポジトリパス
 * @param articleFileBasename Zenn `articles/` 配下のファイル名ベース（拡張子なし）
 */
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

  try {
    await runGit(zennRepoPath, ["diff", "--cached", "--quiet"]);
    console.log(`[INFO] No changes to publish for ${article.slug}.`);
    return;
  } catch {
    // diff --quiet exits non-zero when there are staged changes.
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

  if (!githubToken) {
    await runGit(zennRepoPath, ["push"]);
    return;
  }

  const remoteUrl = await runGitWithStdout(zennRepoPath, ["remote", "get-url", "origin"]);
  if (!remoteUrl.startsWith("https://")) {
    await runGit(zennRepoPath, ["push"]);
    return;
  }

  const currentBranch = await runGitWithStdout(zennRepoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const authenticatedRemoteUrl = buildAuthenticatedRemoteUrl(remoteUrl, githubToken);
  await runGit(zennRepoPath, ["push", authenticatedRemoteUrl, `HEAD:${currentBranch}`]);
};
