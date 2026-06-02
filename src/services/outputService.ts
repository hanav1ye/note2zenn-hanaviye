/**
 * リライト済み本文を Zenn リポへ書き出し（Output ステップ）。
 *
 * フロントマター付与 → 本文の後処理（タイトル重複除去・末尾タグ除去など）
 * → articles/<basename>.md として Zenn リポに直接保存する。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ParsedArticle } from "../types/article.js";
import { stripTrailingMarkdownImages } from "../utils/markdown.js";

/** Zenn 向け YAML フロントマター（published: false で下書き） */
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

/** LLM 出力先頭の # タイトル行を除去（フロントマターと重複しないように） */
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

/** note 由来の末尾ハッシュタグ列や募集見出しを除去 */
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

/** Zenn の :::message 構文へ正規化（note 由来の details/message 風記法を吸収） */
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

export const writeArticle = async (
  article: ParsedArticle,
  rewrittenMarkdown: string,
  zennRepoPath: string,
  articleFileBasename: string,
  tags: string[]
): Promise<string> => {
  const articlesDir = path.join(zennRepoPath, "articles");
  await fs.mkdir(articlesDir, { recursive: true });
  const filePath = path.join(articlesDir, `${articleFileBasename}.md`);

  const frontMatter = buildFrontMatter(article.title, tags);
  const sanitizedBody = stripTitleFromBody(rewrittenMarkdown, article.title);
  const bodyWithoutTagCollection = stripTrailingTagCollection(sanitizedBody);
  const bodyWithoutTrailingImages = stripTrailingMarkdownImages(bodyWithoutTagCollection);
  const normalizedBody = normalizeMessageBlocks(bodyWithoutTrailingImages);

  await fs.writeFile(filePath, `${frontMatter}${normalizedBody}\n`, "utf-8");
  return filePath;
};
