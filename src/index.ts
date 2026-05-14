import { downloadImages } from "./services/assetService.js";
import { analyzeHtml } from "./services/analysisService.js";
import { loadConverterConfig, loadRuntimeConfig } from "./services/configService.js";
import { copyToZennRepo } from "./services/copyService.js";
import { fetchNoteHtml } from "./services/fetchService.js";
import { publishToZennRepo } from "./services/gitService.js";
import { createLlmClient } from "./services/llmService.js";
import { writeArticle } from "./services/outputService.js";
import { logStepEnd, logStepStart } from "./utils/logger.js";
import { projectRoot } from "./utils/paths.js";

/**
 * CLI引数からnote記事URLを取得する。
 * @returns 変換対象のnote記事URL
 * @throws {Error} URL引数が未指定の場合
 */
const loadNoteUrlFromCli = (): string => {
  const rawArgs: string[] = process.argv.slice(2);
  const noteUrlOptionPrefix = "--note-url=";
  const noteUrlFromOption = rawArgs.find((arg) => arg.startsWith(noteUrlOptionPrefix));
  const noteUrlFromValue = noteUrlFromOption?.slice(noteUrlOptionPrefix.length).trim();
  const positionalUrl = rawArgs.find((arg) => !arg.startsWith("--"))?.trim();
  const noteUrl = noteUrlFromValue || positionalUrl;

  if (!noteUrl) {
    throw new Error("note URL is required. pass with '--note-url=<url>' or positional '<url>'.");
  }
  return noteUrl;
};

/**
 * 記事変換の全処理フローを順番に実行するエントリーポイント。
 * @returns 実行完了を表すPromise
 */
const run = async (): Promise<void> => {
  try {
    logStepStart("Initialize");
    const runtimeConfig = loadRuntimeConfig();
    const noteUrl = loadNoteUrlFromCli();
    const converterConfig = loadConverterConfig();
    const llmClient = await createLlmClient(runtimeConfig);
    logStepEnd("Initialize");

    logStepStart("Fetch");
    const html = await fetchNoteHtml(noteUrl);
    logStepEnd("Fetch");

    logStepStart("Analysis");
    const article = analyzeHtml(html, noteUrl);
    logStepEnd("Analysis");

    logStepStart("Inference");
    const rewritten = await llmClient.rewrite(article.markdown, converterConfig, article.slug);
    logStepEnd("Inference");

    logStepStart("Download / Output");
    await downloadImages(article);
    const articlePath = await writeArticle(article, rewritten);
    logStepEnd("Download / Output");

    logStepStart("Copy");
    await copyToZennRepo(article, articlePath, projectRoot, runtimeConfig.zennRepoPath);
    logStepEnd("Copy");

    logStepStart("Publish");
    await publishToZennRepo(article, runtimeConfig.zennRepoPath);
    logStepEnd("Publish");

    console.log(`Done: ${articlePath}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Fatal: ${message}`);
    process.exit(1);
  }
};

void run();
