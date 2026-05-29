import slugify from "slugify";

/**
 * 任意の文字列を記事スラッグへ変換する。
 * @param value 元文字列
 * @returns URL安全なスラッグ
 */
export const toSlug = (value: string): string => {
  return slugify(value, { lower: true, strict: true, locale: "ja" }) || "article";
};

/** ファイル名に使えない文字（Windows 等）。 */
const INVALID_FILE_NAME_CHARS = /[\\/:*?"<>|]/g;

/**
 * Analysis 出力用ベース名をファイルシステム向けに正規化する。
 * @param value `.env` 等から渡されたベース名（`.md` 付きでも可）
 * @returns 拡張子なしの安全なベース名。空になる場合は空文字列
 */
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
 * Markdown ファイル名ベースを決定する（`articles/` と `images/` で共通）。
 * @param configuredBasename `.env` の `ANALYSIS_MARKDOWN_BASENAME`（未設定可）
 * @param slug 記事スラッグ（未指定時のフォールバック）
 * @returns 拡張子なしのベース名
 */
export const resolveAnalysisMarkdownBasename = (configuredBasename: string | undefined, slug: string): string => {
  const trimmed = configuredBasename?.trim();
  if (!trimmed) {
    return slug;
  }
  const sanitized = sanitizeAnalysisBasename(trimmed);
  return sanitized || slug;
};

/**
 * タグ文字列をZenn向けに正規化する。
 * @param tag 元タグ
 * @returns 正規化済みタグ
 */
export const normalizeTag = (tag: string): string => {
  return tag
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-_]/gu, "")
    .toLowerCase();
};

/** Markdown 1行画像のパターン（`![alt](url)`）。 */
const MARKDOWN_IMAGE_LINE_PATTERN = /^!\[[^\]]*\]\([^)]+\)\s*$/;

/**
 * 本文末尾に連続する Markdown 画像行（とその前後の空行）を除去する。
 * @param markdown 対象 Markdown
 * @returns 末尾画像除去後の Markdown
 */
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
