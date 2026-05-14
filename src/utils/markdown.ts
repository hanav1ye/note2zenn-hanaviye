import slugify from "slugify";

/**
 * 任意の文字列を記事スラッグへ変換する。
 * @param value 元文字列
 * @returns URL安全なスラッグ
 */
export const toSlug = (value: string): string => {
  return slugify(value, { lower: true, strict: true, locale: "ja" }) || "article";
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
