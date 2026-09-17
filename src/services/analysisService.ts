/**
 * note 記事 HTML の解析（Analysis ステップ）。
 *
 * タイトル・本文 Markdown・画像一覧を抽出する。タグは Inference（OpenAI）で生成する。
 */
import * as cheerio from "cheerio";
import { collectReferencedImages, replaceArticleImagesWithMarkdown } from "../conversion/analysisImages.js";
import { convertArticleHtmlToMarkdown } from "../conversion/articleMarkdownConverter.js";
import { ParsedArticle } from "../types/article.js";
import { resolveAnalysisMarkdownBasename, stripTrailingMarkdownImages, toSlug } from "../utils/markdown.js";

/** タイトル末尾に付与される著者名を除去する。 */
const sanitizeTitle = (rawTitle: string): string => rawTitle.replace(/\s*[｜|]\s*[^｜|]+$/, "").trim();

/**
 * note 記事 HTML を解析し ParsedArticle を返す。
 * @param configuredBasename サイドバー入力または note2zenn.defaultAnalysisBasename（未設定時は slug）
 */
export const analyzeHtml = (
  html: string,
  baseUrl: string,
  configuredBasename?: string
): ParsedArticle => {
  const $ = cheerio.load(html);

  const ogTitle = $("meta[property='og:title']").attr("content")?.trim();
  const docTitle = $("title").text().trim();
  const title = sanitizeTitle(ogTitle || docTitle || "untitled");
  const slug = toSlug(title);
  const assetDir = resolveAnalysisMarkdownBasename(configuredBasename, slug);

  const imageMap = replaceArticleImagesWithMarkdown($, baseUrl, assetDir);

  const bodyText = $("article").html() ?? $("body").html() ?? "";
  const markdown = stripTrailingMarkdownImages(convertArticleHtmlToMarkdown(bodyText, baseUrl));

  return {
    title,
    slug,
    assetDir,
    markdown,
    images: collectReferencedImages(imageMap, markdown, assetDir)
  };
};
