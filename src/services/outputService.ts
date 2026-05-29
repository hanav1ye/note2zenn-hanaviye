import fs from "node:fs/promises";
import path from "node:path";
import { ParsedArticle } from "../types/article.js";
import { stripTrailingMarkdownImages } from "../utils/markdown.js";

/**
 * Zenn向けフロントマターを生成する。
 * @param title 記事タイトル
 * @param tags タグ一覧
 * @returns フロントマター文字列
 */
const buildFrontMatter = (title: string, tags: string[]): string => {
  const sanitizedTags = tags.slice(0, 5);
  return [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    "emoji: \"📝\"",
    "type: \"tech\"",
    "published: false",
    `tags: [${sanitizedTags.map((tag) => `"${tag}"`).join(", ")}]`,
    "---",
    ""
  ].join("\n");
};

/**
 * 本文先頭のタイトル行を除去する。
 * @param markdown リライト済み本文
 * @param title フロントマター用タイトル
 * @returns タイトル行除去後の本文
 */
const stripTitleFromBody = (markdown: string, title: string): string => {
  const lines = markdown.split("\n");
  const normalizedTitle = title.trim();
  const nextLines = [...lines];

  while (nextLines.length > 0 && nextLines[0].trim() === "") {
    nextLines.shift();
  }
  if (nextLines.length > 0 && nextLines[0].trim().startsWith("# ")) {
    nextLines.shift();
    while (nextLines.length > 0 && nextLines[0].trim() === "") {
      nextLines.shift();
    }
  }
  if (nextLines.length > 0 && nextLines[0].trim() === normalizedTitle) {
    nextLines.shift();
    while (nextLines.length > 0 && nextLines[0].trim() === "") {
      nextLines.shift();
    }
  }

  return nextLines.join("\n").trim();
};

/**
 * 本文末尾のタグ集セクションを除去する。
 * @param markdown タイトル除去後の本文
 * @returns タグ集除去後の本文
 */
const stripTrailingTagCollection = (markdown: string): string => {
  const lines = markdown.split("\n");
  const result = [...lines];

  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop();
  }
  while (result.length > 0 && /^#[\p{Letter}\p{Number}_-]+$/u.test(result[result.length - 1].trim())) {
    result.pop();
    while (result.length > 0 && result[result.length - 1].trim() === "") {
      result.pop();
    }
  }

  const tailHeading = result[result.length - 1]?.trim() ?? "";
  if (tailHeading === "### この記事が参加している募集" || tailHeading === "## この記事が参加している募集") {
    result.pop();
    while (result.length > 0 && result[result.length - 1].trim() === "") {
      result.pop();
    }
  }

  return result.join("\n").trim();
};

/**
 * messageブロック構文を正規化する。
 * @param markdown タグ除去後の本文
 * @returns message構文正規化後の本文
 */
const normalizeMessageBlocks = (markdown: string): string => {
  const lines = markdown.split("\n");
  const normalizedLines: string[] = [];
  let insideMessageBlock = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (/^:{3,}\s*details(?:\s+.*)?$/i.test(trimmedLine) || /^:{3,}\s*message(?:\s+.*)?$/i.test(trimmedLine)) {
      normalizedLines.push(":::message");
      insideMessageBlock = true;
      continue;
    }

    if (insideMessageBlock && /^:{3,}\s*$/.test(trimmedLine)) {
      normalizedLines.push(":::");
      insideMessageBlock = false;
      continue;
    }

    normalizedLines.push(line);
  }

  if (insideMessageBlock) {
    normalizedLines.push(":::");
  }

  return normalizedLines.join("\n").trim();
};

/**
 * リライト済み記事を Zenn リポジトリの `articles/` へ直接出力する（本リポジトリには書かない）。
 * @param article 解析済み記事データ
 * @param rewrittenMarkdown リライト済み本文
 * @param zennRepoPath Zenn リポジトリのルートパス
 * @param articleFileBasename 記事ファイル名のベース（拡張子なし）
 * @returns 生成した記事ファイルパス
 */
export const writeArticle = async (
  article: ParsedArticle,
  rewrittenMarkdown: string,
  zennRepoPath: string,
  articleFileBasename: string
): Promise<string> => {
  const articlesDir = path.join(zennRepoPath, "articles");
  await fs.mkdir(articlesDir, { recursive: true });
  const filePath = path.join(articlesDir, `${articleFileBasename}.md`);
  const frontMatter = buildFrontMatter(article.title, article.tags);
  const sanitizedBody = stripTitleFromBody(rewrittenMarkdown, article.title);
  const bodyWithoutTagCollection = stripTrailingTagCollection(sanitizedBody);
  const bodyWithoutTrailingImages = stripTrailingMarkdownImages(bodyWithoutTagCollection);
  const normalizedBody = normalizeMessageBlocks(bodyWithoutTrailingImages);
  await fs.writeFile(filePath, `${frontMatter}${normalizedBody}\n`, "utf-8");
  return filePath;
};
