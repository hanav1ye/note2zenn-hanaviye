import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ParsedArticle } from "../types/article.js";

const execFileAsync = promisify(execFile);

/**
 * 指定ディレクトリでgitコマンドを実行する。
 * @param args git引数
 * @param cwd 実行ディレクトリ
 */
const runGit = async (args: string[], cwd: string): Promise<void> => {
  await execFileAsync("git", args, { cwd });
};

/**
 * 指定ディレクトリでgitコマンドを実行し、標準出力を返す。
 * @param args git引数
 * @param cwd 実行ディレクトリ
 * @returns 標準出力
 */
const runGitWithStdout = async (args: string[], cwd: string): Promise<string> => {
  const result = await execFileAsync("git", args, { cwd });
  return result.stdout.trim();
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
 */
export const publishToZennRepo = async (article: ParsedArticle, zennRepoPath: string): Promise<void> => {
  const articlePath = `articles/${article.slug}.md`;
  const imagePath = `images/${article.slug}`;
  const commitMessage = `add ${article.slug}`;
  const commitUserName = process.env.GIT_AUTHOR_NAME ?? "note2zenn-bot";
  const commitUserEmail = process.env.GIT_AUTHOR_EMAIL ?? "note2zenn-bot@example.local";
  const githubToken = process.env.GITHUB_TOKEN;

  await runGit(["add", "--", articlePath, imagePath], zennRepoPath);

  try {
    await runGit(["diff", "--cached", "--quiet"], zennRepoPath);
    console.log(`[INFO] No changes to publish for ${article.slug}.`);
    return;
  } catch {
    // diff --quiet exits non-zero when there are staged changes.
  }

  await runGit(
    ["-c", `user.name=${commitUserName}`, "-c", `user.email=${commitUserEmail}`, "commit", "-m", commitMessage],
    zennRepoPath
  );

  if (!githubToken) {
    await runGit(["push"], zennRepoPath);
    return;
  }

  const remoteUrl = await runGitWithStdout(["remote", "get-url", "origin"], zennRepoPath);
  if (!remoteUrl.startsWith("https://")) {
    await runGit(["push"], zennRepoPath);
    return;
  }

  const currentBranch = await runGitWithStdout(["rev-parse", "--abbrev-ref", "HEAD"], zennRepoPath);
  const authenticatedRemoteUrl = buildAuthenticatedRemoteUrl(remoteUrl, githubToken);
  await runGit(["push", authenticatedRemoteUrl, `HEAD:${currentBranch}`], zennRepoPath);
};
