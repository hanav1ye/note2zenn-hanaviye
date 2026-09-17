/**
 * note 記事 HTML から画像を抽出し、Markdown 画像構文へ置換する。
 */
import type { CheerioAPI } from "cheerio";
import path from "node:path";
import type { ImageAsset } from "../types/article.js";

export type ImageMapEntry = {
  fileName: string;
  altText: string;
  resolvedUrl: string;
};

export type ImageMap = Map<string, ImageMapEntry>;

type CheerioElement = ReturnType<CheerioAPI>;

const escapeMarkdownImageAlt = (value: string): string => value.replace(/\|/g, "\\|");

const resolveImageUrl = (src: string, baseUrl: string): string | null => {
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
};

const isDownloadableImageUrl = (value: string): boolean =>
  value.startsWith("http://") || value.startsWith("https://");

/** note のアイキャッチ（見出し画像）かどうかを判定する。 */
const isNoteHeaderImage = (figureCaption: string, imgAlt: string): boolean =>
  [figureCaption, imgAlt].some((value) => value.trim().includes("見出し画像"));

const isEmptyTrailingBlock = ($: CheerioAPI, $el: CheerioElement): boolean => {
  const tag = $el.prop("tagName")?.toLowerCase();
  if (tag === "br" || tag === "hr") {
    return true;
  }
  return $el.text().trim().length === 0;
};

const isImageOnlyBlock = ($: CheerioAPI, $el: CheerioElement): boolean => {
  const tag = $el.prop("tagName")?.toLowerCase();
  if (tag === "figure" || tag === "img") {
    return tag === "img" || $el.find("img").length > 0;
  }
  if (tag === "p" || tag === "div") {
    if ($el.find("img").length === 0) {
      return false;
    }
    const clone = $el.clone();
    clone.find("img, br").remove();
    return clone.text().trim().length === 0;
  }
  return false;
};

const isSubstantiveContentBlock = ($: CheerioAPI, $el: CheerioElement): boolean => {
  if (isEmptyTrailingBlock($, $el) || isImageOnlyBlock($, $el)) {
    return false;
  }
  return $el.text().trim().length > 0;
};

const extractImageSrc = ($: CheerioAPI, $el: CheerioElement): string | undefined => {
  const tag = $el.prop("tagName")?.toLowerCase();
  if (tag === "img") {
    return $el.attr("src");
  }
  return $el.find("img").first().attr("src");
};

const registerImageInMap = (
  imageMap: ImageMap,
  src: string,
  altText: string,
  baseUrl: string
): ImageMapEntry | null => {
  const existing = imageMap.get(src);
  if (existing) {
    return existing;
  }
  const resolvedUrl = resolveImageUrl(src, baseUrl);
  if (!resolvedUrl || !isDownloadableImageUrl(resolvedUrl)) {
    return null;
  }
  const ext = path.extname(new URL(resolvedUrl).pathname) || ".jpg";
  const entry: ImageMapEntry = {
    fileName: `${imageMap.size + 1}${ext}`,
    altText,
    resolvedUrl
  };
  imageMap.set(src, entry);
  return entry;
};

/** 本文直後の画像は残し、末尾の署名画像だけを除去する。 */
const removeTrailingImagesFromArticle = ($: CheerioAPI, imageMap: ImageMap): void => {
  const $root = $("article").length > 0 ? $("article") : $("body");
  if ($root.length === 0) {
    return;
  }

  const children = $root.children().toArray();
  if (children.length === 0) {
    return;
  }

  let end = children.length - 1;
  while (end >= 0 && isEmptyTrailingBlock($, $(children[end]))) {
    $(children[end]).remove();
    end -= 1;
  }
  if (end < 0) {
    return;
  }

  let runStart = end;
  while (runStart >= 0 && isImageOnlyBlock($, $(children[runStart]))) {
    runStart -= 1;
  }
  runStart += 1;

  if (runStart > end) {
    return;
  }

  let prevIdx = runStart - 1;
  while (prevIdx >= 0 && isEmptyTrailingBlock($, $(children[prevIdx]))) {
    prevIdx -= 1;
  }

  const removeChildAt = (index: number): void => {
    const $child = $(children[index]);
    const src = extractImageSrc($, $child);
    if (src) {
      imageMap.delete(src);
    }
    $child.remove();
  };

  if (prevIdx >= 0 && isSubstantiveContentBlock($, $(children[prevIdx]))) {
    removeChildAt(end);
    return;
  }

  for (let index = end; index >= runStart; index -= 1) {
    removeChildAt(index);
  }
};

const toMarkdownImageLine = (entry: ImageMapEntry, assetDir: string): string =>
  `![${escapeMarkdownImageAlt(entry.altText)}](/images/${assetDir}/${entry.fileName})\n\n`;

/**
 * figure / img を走査して imageMap を構築し、DOM 上の画像を Markdown 画像構文へ置換する。
 */
export const replaceArticleImagesWithMarkdown = (
  $: CheerioAPI,
  baseUrl: string,
  assetDir: string
): ImageMap => {
  const imageMap: ImageMap = new Map();

  $("figure").each((_, figure) => {
    const $figure = $(figure);
    const image = $figure.find("img").first();
    const src = image.attr("src");
    if (!src) {
      return;
    }
    const figureCaption = $figure.find("figcaption").text().trim();
    const imgAlt = image.attr("alt")?.trim() ?? "";
    if (isNoteHeaderImage(figureCaption, imgAlt)) {
      $figure.remove();
      return;
    }
    registerImageInMap(imageMap, src, figureCaption || imgAlt || "image", baseUrl);
  });

  removeTrailingImagesFromArticle($, imageMap);

  $("img").each((_, image) => {
    const $image = $(image);
    const src = $image.attr("src");
    if (!src) {
      return;
    }
    const imgAlt = $image.attr("alt")?.trim() ?? "";
    if (isNoteHeaderImage("", imgAlt)) {
      $image.remove();
      return;
    }
    const entry = imageMap.get(src) ?? registerImageInMap(imageMap, src, imgAlt || "image", baseUrl);
    if (!entry) {
      return;
    }
    $image.replaceWith(toMarkdownImageLine(entry, assetDir));
  });

  $("figure").each((_, figure) => {
    const $figure = $(figure);
    $figure.find("figcaption").remove();
    const content = $figure.html()?.trim();
    if (content) {
      $figure.replaceWith(content);
    } else {
      $figure.remove();
    }
  });

  return imageMap;
};

/** Markdown 内で参照されている画像だけを ImageAsset 配列として返す。 */
export const collectReferencedImages = (
  imageMap: ImageMap,
  markdown: string,
  assetDir: string
): ImageAsset[] =>
  Array.from(imageMap.values())
    .filter((entry) => markdown.includes(`/images/${assetDir}/${entry.fileName}`))
    .map((entry) => ({
      originalUrl: entry.resolvedUrl,
      localFileName: entry.fileName,
      localPath: `/images/${assetDir}/${entry.fileName}`,
      altText: entry.altText
    }));
