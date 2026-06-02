/**
 * Markdown / ファイル名まわりの共通ユーティリティ。
 *
 * Analysis・Output 両方から使う:
 * - スラッグ・basename の決定
 * - タグ正規化
 * - 末尾画像行の除去
 */
import slugify from "slugify";

export const toSlug = (value: string): string => {
  return slugify(value, { lower: true, strict: true, locale: "ja" }) || "article";
};

const INVALID_FILE_NAME_CHARS = /[\\/:*?"<>|]/g;

/** サイドバー入力の basename をファイルシステム向けに安全化（.md 拡張子は除去） */
export const sanitizeAnalysisBasename = (value: string): string => {
  let base = value
    .trim()
    .replace(INVALID_FILE_NAME_CHARS, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/u, "");

  if (base.toLowerCase().endsWith(".md")) {
    base = base.slice(0, -3).replace(/[. ]+$/u, "");
  }

  if (base.length > 200) {
    base = base.slice(0, 200).replace(/[. ]+$/u, "");
  }

  return base;
};

/**
 * articles/*.md と images/<dir>/ で共通のベース名を決める。
 * 未指定時は記事スラッグにフォールバック。
 */
export const resolveAnalysisMarkdownBasename = (configuredBasename: string | undefined, slug: string): string => {
  const trimmed = configuredBasename?.trim();
  if (!trimmed) {
    return slug;
  }
  const sanitized = sanitizeAnalysisBasename(trimmed);
  return sanitized || slug;
};

export const normalizeTag = (tag: string): string => {
  return tag
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-_]/gu, "")
    .toLowerCase();
};

const MARKDOWN_IMAGE_LINE_PATTERN = /^!\[[^\]]*\]\([^)]+\)\s*$/;

/** 本文末尾に連続する `![...](...)` 行（と空行）を除去 */
export const stripTrailingMarkdownImages = (markdown: string): string => {
  const lines = markdown.split("\n");

  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  while (lines.length > 0 && MARKDOWN_IMAGE_LINE_PATTERN.test(lines[lines.length - 1].trim())) {
    lines.pop();
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
  }

  return lines.join("\n").trim();
};
