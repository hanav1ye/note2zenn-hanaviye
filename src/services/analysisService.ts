import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import path from "node:path";
import { ParsedArticle } from "../types/article.js";
import { normalizeTag, toSlug } from "../utils/markdown.js";

/**
 * Markdownで衝突しやすい記号をエスケープする。
 * @param value 元文字列
 * @returns エスケープ済み文字列
 */
const escapeMarkdown = (value: string): string => value.replace(/\|/g, "\\|");

/**
 * note の `<br>` を Zenn / CommonMark でハード改行として解釈させるためのマーカー（行末スペース2つ + LF）。
 * @see https://spec.commonmark.org/0.31.2/#hard-line-breaks
 */
const MARKDOWN_HARD_LINE_BREAK = "  \n" as const;

/**
 * 画像URLを絶対URLへ正規化する。
 * @param src 元のsrc属性値
 * @param baseUrl note記事URL
 * @returns 絶対URL。解決できない場合はnull
 */
const resolveImageUrl = (src: string, baseUrl: string): string | null => {
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
};

/**
 * ダウンロード対象として扱えるURLかを判定する。
 * @param value 判定対象URL
 * @returns http/https の場合に true
 */
const isDownloadableImageUrl = (value: string): boolean => {
  return value.startsWith("http://") || value.startsWith("https://");
};

/**
 * 本文から技術テーマ語を抽出してタグ候補を作る。
 * @param markdown 本文Markdown
 * @returns Zenn向けタグ一覧
 */
const extractTechnicalTags = (markdown: string): string[] => {
  const keywordPattern = /[A-Za-z][A-Za-z0-9+#.\-]{1,}|[ァ-ヶー]{2,}|[一-龠々]{2,}/gu;
  const blockedWords = new Set<string>([
    "note",
    "zenn",
    "記事",
    "目的",
    "計画",
    "注意点",
    "今回",
    "自分",
    "読者",
    "開発記"
  ]);
  const preferredTerms = [
    "llm",
    "ai",
    "openai",
    "gemma",
    "cursor",
    "claude",
    "chatgpt",
    "api",
    "docker",
    "typescript",
    "node",
    "markdown",
    "zenn",
    "note"
  ];

  const rawTokens = markdown.match(keywordPattern) ?? [];
  const counts = new Map<string, number>();
  for (const token of rawTokens) {
    const normalized = normalizeTag(token);
    if (!normalized) {
      continue;
    }
    if (normalized.length < 2 || normalized.length > 20) {
      continue;
    }
    if (blockedWords.has(normalized)) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([word]) => word);
  const selected: string[] = [];

  for (const preferred of preferredTerms) {
    if (ranked.includes(preferred) && !selected.includes(preferred)) {
      selected.push(preferred);
    }
    if (selected.length >= 5) {
      return selected;
    }
  }

  for (const word of ranked) {
    if (!selected.includes(word)) {
      selected.push(word);
    }
    if (selected.length >= 5) {
      break;
    }
  }

  return selected;
};

/**
 * タイトル末尾に付与される著者名を除去する。
 * @param rawTitle 元タイトル
 * @returns 著者名を除去したタイトル
 */
const sanitizeTitle = (rawTitle: string): string => {
  return rawTitle.replace(/\s*[｜|]\s*[^｜|]+$/, "").trim();
};

/**
 * note のアイキャッチ（見出し画像）かどうかを判定する。
 * 本文・ダウンロード対象から除外する。
 * @param figureCaption figure のキャプション
 * @param imgAlt img の alt
 * @returns 見出し画像とみなす場合 true
 */
const isNoteHeaderImage = (figureCaption: string, imgAlt: string): boolean => {
  const caption = figureCaption.trim();
  const alt = imgAlt.trim();
  if (caption === "見出し画像" || alt === "見出し画像") {
    return true;
  }
  if (caption.includes("見出し画像") || alt.includes("見出し画像")) {
    return true;
  }
  return false;
};

/**
 * インラインコードを Markdown のバックティックで包む。内部にバックティックがある場合はフェンス長を伸ばす。
 * @param raw コード本文
 * @returns Markdown インラインコード
 */
const wrapInlineCode = (raw: string): string => {
  if (raw.includes("\n")) {
    let fence = "```";
    while (raw.includes(fence)) {
      fence += "`";
    }
    return `\n${fence}\n${raw.trimEnd()}\n${fence}\n`;
  }
  let fence = "`";
  while (raw.includes(fence)) {
    fence += "`";
  }
  return `${fence}${raw}${fence}`;
};

/**
 * フェンス付きコードブロック文字列を組み立てる。
 * @param lang 言語識別子（空可）
 * @param body コード本文
 * @returns Markdown コードフェンス
 */
const buildFencedCodeBlock = (lang: string, body: string): string => {
  let fence = "```";
  while (body.includes(fence)) {
    fence += "`";
  }
  const langLine = lang.trim();
  return `\n${fence}${langLine ? langLine : ""}\n${body.trimEnd()}\n${fence}\n`;
};

/**
 * リンク href を絶対URLへ正規化する。
 * @param href 元のhref
 * @param baseUrl note記事URL
 * @returns 絶対URL文字列
 */
const resolveLinkHref = (href: string, baseUrl: string): string => {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
};

/**
 * note 記事 DOM の見出しを Zenn 向け ATX Markdown の行へ変換する。
 * `hN` は行頭の `#` を N 個とした見出し行に対応する（例: `h2` → `## タイトル`, `h3` → `### タイトル`）。
 * ネストした見出しを壊さないよう、`h6` から `h1` の順で置換する。
 * @param $ `__article-root` を含むフラグメントに束縛された Cheerio API
 */
const convertNoteHeadingsToAtxMarkdown = ($: CheerioAPI): void => {
  const $root = $("#__article-root");
  for (let level = 6; level >= 1; level--) {
    $root.find(`h${level}`).each((_, el) => {
      const $h = $(el);
      const raw = $h.text().replace(/\s+/g, " ").trim();
      if (raw.length === 0) {
        $h.remove();
        return;
      }
      $h.replaceWith(`${"#".repeat(level)} ${raw}\n\n`);
    });
  }
};

/**
 * article 本文HTMLをプレーンテキスト化する。
 * strong / b・リンク・コードを Markdown 風に変換してから抽出する。
 * `<br>` は CommonMark ハード改行（行末スペース2つ + LF）へ置換する。
 * 見出しは `convertNoteHeadingsToAtxMarkdown` で ATX 行へ確定する。
 * `.text()` はブロック境界の改行を含まないため、主要ブロック末尾に改行を付与してから抽出する（`p` は段落区切り用に `\n\n`、それ以外は `\n`）。
 * @param fragmentHtml article 要素の innerHTML 相当
 * @param baseUrl note記事URL（相対リンク解決用）
 * @returns Markdown 要素を含んだ本文テキスト
 */
const articleHtmlToMarkdownish = (fragmentHtml: string, baseUrl: string): string => {
  const $ = cheerio.load(`<div id="__article-root">${fragmentHtml}</div>`, null, false);

  $("br").each((_, el) => {
    $(el).replaceWith(MARKDOWN_HARD_LINE_BREAK);
  });

  while ($("#__article-root pre").length > 0) {
    const $pre = $("#__article-root pre").first();
    const $innerCode = $pre.find("code").first();
    let lang = "";
    if ($innerCode.length > 0) {
      const cls = $innerCode.attr("class") ?? "";
      const langMatch = cls.match(/language-([\w-]+)/);
      lang = langMatch ? (langMatch[1] ?? "") : "";
    }
    const bodySource = $innerCode.length > 0 ? $innerCode : $pre;
    const bodyTextContent = bodySource.text();
    $pre.replaceWith(buildFencedCodeBlock(lang, bodyTextContent));
  }

  let guard = 0;
  while (guard++ < 10000) {
    const codeLeaves = $("#__article-root code").filter((_, el) => $(el).find("code").length === 0);
    if (codeLeaves.length > 0) {
      codeLeaves.each((_, el) => {
        const $el = $(el);
        $el.replaceWith(wrapInlineCode($el.text()));
      });
      continue;
    }
    const strongLeaves = $("#__article-root strong, #__article-root b").filter((_, el) => $(el).find("strong, b").length === 0);
    if (strongLeaves.length > 0) {
      strongLeaves.each((_, el) => {
        const $el = $(el);
        const innerText = $el.text().replace(/\*/g, "\\*");
        $el.replaceWith(`**${innerText}**`);
      });
      continue;
    }
    break;
  }

  guard = 0;
  while (guard++ < 10000) {
    const linkLeaves = $("#__article-root a[href]").filter((_, el) => $(el).find("a").length === 0);
    if (linkLeaves.length === 0) {
      break;
    }
    linkLeaves.each((_, el) => {
      const $a = $(el);
      const rawHref = $a.attr("href")?.trim() ?? "";
      const labelRaw = $a.text().trim();
      if (!rawHref) {
        $a.replaceWith(labelRaw);
        return;
      }
      const resolvedHref = resolveLinkHref(rawHref, baseUrl);
      const label = labelRaw.length > 0 ? labelRaw : resolvedHref;
      const safeLabel = label.replace(/\]/g, "\\]");
      $a.replaceWith(`[${safeLabel}](${resolvedHref})`);
    });
  }

  const $root = $("#__article-root");
  convertNoteHeadingsToAtxMarkdown($);

  // `.text()` 直前にブロック境界の改行を付与する（上記 JSDoc 参照）。見出しは上で Markdown 化済みのため対象外。
  for (const el of $root.find("p").toArray()) {
    $(el).append("\n\n");
  }
  for (const el of $root.find("blockquote, li, hr, tr").toArray()) {
    $(el).append("\n");
  }
  for (const el of $root.children("div").toArray()) {
    $(el).append("\n");
  }

  return $("#__article-root").text().trim();
};

/**
 * note記事HTMLを解析し、本文・タグ・画像情報を抽出する。
 * @param html 解析対象HTML
 * @param baseUrl note記事URL
 * @returns 解析済み記事データ
 */
export const analyzeHtml = (html: string, baseUrl: string): ParsedArticle => {
  const $ = cheerio.load(html);
  const rawTitle: string = $("meta[property='og:title']").attr("content") ?? $("title").text().trim() ?? "untitled";
  const title: string = sanitizeTitle(rawTitle);
  const slug: string = toSlug(title);

  const imageMap = new Map<string, { fileName: string; altText: string; resolvedUrl: string }>();
  $("figure").each((_, figure) => {
    const image = $(figure).find("img").first();
    const src = image.attr("src");
    if (!src) {
      return;
    }
    const figureCaption: string = $(figure).find("figcaption").text().trim();
    const imgAlt: string = image.attr("alt")?.trim() ?? "";
    if (isNoteHeaderImage(figureCaption, imgAlt)) {
      $(figure).remove();
      return;
    }
    const altText = figureCaption || imgAlt || "image";
    const resolvedUrl = resolveImageUrl(src, baseUrl);
    if (!resolvedUrl) {
      return;
    }
    if (!isDownloadableImageUrl(resolvedUrl)) {
      return;
    }
    const ext = path.extname(new URL(resolvedUrl).pathname) || ".jpg";
    const fileName = `${imageMap.size + 1}${ext}`;
    imageMap.set(src, { fileName, altText, resolvedUrl });
  });

  $("img").each((_, image) => {
    const src = $(image).attr("src");
    if (!src) {
      return;
    }
    const altForHeader = $(image).attr("alt")?.trim() ?? "";
    if (isNoteHeaderImage("", altForHeader)) {
      $(image).remove();
      return;
    }
    if (!imageMap.has(src)) {
      const alt = altForHeader || "image";
      const resolvedUrl = resolveImageUrl(src, baseUrl);
      if (!resolvedUrl) {
        return;
      }
      if (!isDownloadableImageUrl(resolvedUrl)) {
        return;
      }
      const ext = path.extname(new URL(resolvedUrl).pathname) || ".jpg";
      const fileName = `${imageMap.size + 1}${ext}`;
      imageMap.set(src, { fileName, altText: alt, resolvedUrl });
    }
    const mapped = imageMap.get(src);
    if (!mapped) {
      return;
    }
    $(image).replaceWith(`![${escapeMarkdown(mapped.altText)}](/images/${slug}/${mapped.fileName})`);
  });

  $("figure").each((_, figure) => {
    const markdown = $(figure).find("img").first().toString();
    if (!markdown) {
      return;
    }
    $(figure).replaceWith(markdown);
  });

  const bodyText = $("article").html() ?? $("body").html() ?? "";
  const markdown: string = articleHtmlToMarkdownish(bodyText, baseUrl);

  const tags = extractTechnicalTags(markdown);

  return {
    title,
    slug,
    markdown,
    tags,
    images: Array.from(imageMap.entries()).map(([originalUrl, value]) => ({
      originalUrl: value.resolvedUrl,
      localFileName: value.fileName,
      localPath: `/images/${slug}/${value.fileName}`,
      altText: value.altText
    }))
  };
};
