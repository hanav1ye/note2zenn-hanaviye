/**
 * note 記事本文 HTML を Markdown 風テキストへ変換する。
 */
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

const ARTICLE_ROOT_ID = "__article-root";
const ARTICLE_ROOT = `#${ARTICLE_ROOT_ID}`;
const MARKDOWN_HARD_LINE_BREAK = "  \n" as const;
const MARKDOWN_HORIZONTAL_RULE = "\n\n---\n\n" as const;
const MAX_DOM_REPLACE_ITERATIONS = 10_000;

type CheerioElement = ReturnType<CheerioAPI>;

const resolveLinkHref = (href: string, baseUrl: string): string => {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
};

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

const buildFencedCodeBlock = (lang: string, body: string): string => {
  let fence = "```";
  while (body.includes(fence)) {
    fence += "`";
  }
  const langLine = lang.trim();
  return `\n${fence}${langLine ? langLine : ""}\n${body.trimEnd()}\n${fence}\n`;
};

/** 改行を含む strong は行単位で閉じ、ハード改行（行末 `  `）を保持する。 */
const wrapStrongText = (raw: string): string => {
  const escaped = raw.replace(/\*/g, "\\*");
  if (!escaped.includes("\n")) {
    return `**${escaped}**`;
  }

  return escaped
    .split("\n")
    .map((line) => {
      const hasHardBreak = line.endsWith("  ");
      const base = hasHardBreak ? line.slice(0, -2) : line;
      if (base.length === 0) {
        return hasHardBreak ? "  " : "";
      }
      const wrapped = `**${base}**`;
      return hasHardBreak ? `${wrapped}  ` : wrapped;
    })
    .join("\n");
};

const buildMarkdownLinkReplacement = ($: CheerioAPI, $a: CheerioElement, baseUrl: string): string => {
  const rawHref = $a.attr("href")?.trim() ?? "";
  const labelRaw = $a.text().trim();
  if (!rawHref) {
    return labelRaw;
  }
  const resolvedHref = resolveLinkHref(rawHref, baseUrl);
  const label = labelRaw.length > 0 ? labelRaw : resolvedHref;
  const safeLabel = label.replace(/\]/g, "\\]");
  const markdownLink = `[${safeLabel}](${resolvedHref})`;
  if ($a.closest("p").length > 0) {
    return markdownLink;
  }
  return `\n\n@[card](${resolvedHref})\n\n`;
};

const replaceLeafElements = (
  $: CheerioAPI,
  selector: string,
  nestedSelector: string,
  transform: ($el: CheerioElement) => string
): void => {
  let guard = 0;
  while (guard++ < MAX_DOM_REPLACE_ITERATIONS) {
    const leaves = $(`${ARTICLE_ROOT} ${selector}`).filter((_, el) => $(el).find(nestedSelector).length === 0);
    if (leaves.length === 0) {
      break;
    }
    leaves.each((_, el) => {
      $(el).replaceWith(transform($(el)));
    });
  }
};

const appendBlockBoundaryNewlines = ($: CheerioAPI, $scope: CheerioElement, includeRootDivChildren: boolean): void => {
  $scope.find("p").each((_, el) => {
    $(el).append("\n\n");
  });
  $scope.find("li, tr").each((_, el) => {
    $(el).append("\n");
  });
  if (includeRootDivChildren) {
    $scope.children("div").each((_, el) => {
      $(el).append("\n");
    });
  }
};

const convertNoteHorizontalRulesToMarkdown = ($: CheerioAPI): void => {
  $(`${ARTICLE_ROOT} hr`).each((_, el) => {
    $(el).replaceWith(MARKDOWN_HORIZONTAL_RULE);
  });
};

const convertNoteHeadingsToAtxMarkdown = ($: CheerioAPI): void => {
  const $root = $(ARTICLE_ROOT);
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

const getNestedListDepth = ($: CheerioAPI, listEl: Element): number => $(listEl).parents("ul, ol").length;

const normalizeListItemText = (raw: string): string =>
  raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

const convertListElementToMarkdown = ($: CheerioAPI, listEl: Element): void => {
  const $list = $(listEl);
  const listTag = $list.prop("tagName")?.toLowerCase();
  if (listTag !== "ul" && listTag !== "ol") {
    return;
  }

  const indent = "  ".repeat(getNestedListDepth($, listEl));
  const lines: string[] = [];
  let order = 1;

  $list.children("li").each((_, childEl) => {
    const marker = listTag === "ol" ? `${order}. ` : "- ";
    order += 1;
    const normalized = normalizeListItemText($(childEl).text());
    if (normalized.length === 0) {
      lines.push(`${indent}${marker}`);
      return;
    }
    const parts = normalized.split("\n");
    lines.push(`${indent}${marker}${parts[0]}`);
    for (let i = 1; i < parts.length; i++) {
      lines.push(`${indent}  ${parts[i]}`);
    }
  });

  $list.replaceWith(`\n${lines.join("\n")}\n`);
};

const convertNoteListsToMarkdown = ($: CheerioAPI): void => {
  const lists = $(`${ARTICLE_ROOT} ul, ${ARTICLE_ROOT} ol`)
    .toArray()
    .filter((node): node is Element => node.type === "tag")
    .sort((a, b) => getNestedListDepth($, b) - getNestedListDepth($, a));

  for (const listEl of lists) {
    convertListElementToMarkdown($, listEl);
  }
};

const convertNoteBlockquotesToMarkdown = ($: CheerioAPI): void => {
  const $root = $(ARTICLE_ROOT);
  const findOutermostBlockquote = (): CheerioElement =>
    $root.find("blockquote").filter((_, el) => $(el).parents("blockquote").length === 0).first();

  let $blockquote = findOutermostBlockquote();
  while ($blockquote.length > 0) {
    appendBlockBoundaryNewlines($, $blockquote, false);
    const raw = $blockquote.text().trim();
    if (raw.length === 0) {
      $blockquote.remove();
    } else {
      const quoted = raw
        .split("\n")
        .map((line) => (line.trim() === "" ? ">" : `> ${line}`))
        .join("\n");
      $blockquote.replaceWith(`\n\n${quoted}\n\n`);
    }
    $blockquote = findOutermostBlockquote();
  }
};

/**
 * article 要素の innerHTML 相当を Markdown 風テキストへ変換する。
 */
export const convertArticleHtmlToMarkdown = (fragmentHtml: string, baseUrl: string): string => {
  const $ = cheerio.load(`<div id="${ARTICLE_ROOT_ID}">${fragmentHtml}</div>`, null, false);
  const $root = $(ARTICLE_ROOT);

  $root.find("br").each((_, el) => {
    $(el).replaceWith(MARKDOWN_HARD_LINE_BREAK);
  });

  while ($root.find("pre").length > 0) {
    const $pre = $root.find("pre").first();
    const $innerCode = $pre.find("code").first();
    const cls = $innerCode.attr("class") ?? "";
    const langMatch = cls.match(/language-([\w-]+)/);
    const lang = langMatch ? (langMatch[1] ?? "") : "";
    const bodySource = $innerCode.length > 0 ? $innerCode : $pre;
    $pre.replaceWith(buildFencedCodeBlock(lang, bodySource.text()));
  }

  replaceLeafElements($, "code", "code", ($el) => wrapInlineCode($el.text()));
  replaceLeafElements($, "strong, b", "strong, b", ($el) => wrapStrongText($el.text()));
  replaceLeafElements($, "a[href]", "a", ($el) => buildMarkdownLinkReplacement($, $el, baseUrl));

  convertNoteListsToMarkdown($);
  convertNoteHeadingsToAtxMarkdown($);
  convertNoteHorizontalRulesToMarkdown($);
  convertNoteBlockquotesToMarkdown($);
  appendBlockBoundaryNewlines($, $root, true);

  return $root.text().trim();
};
