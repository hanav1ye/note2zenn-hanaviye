import { downloadImages } from "./services/assetService.js";
import { analyzeHtml } from "./services/analysisService.js";
import { loadConverterConfig, loadRuntimeConfig } from "./services/configService.js";
import { copyImagesToZennRepo } from "./services/copyService.js";
import { fetchNoteHtml } from "./services/fetchService.js";
import { publishToZennRepo } from "./services/gitService.js";
import { createLlmClient } from "./services/llmService.js";
import { writeArticle } from "./services/outputService.js";
import { RuntimeConfig } from "./types/config.js";
import { logStepEnd, logStepStart } from "./utils/logger.js";
import { projectRoot } from "./utils/paths.js";

export interface RunConversionInput {
  noteUrl: string;
  analysisMarkdownBasename?: string;
  runtimeConfig: {
    zennRepoPath: string;
    openAiApiKey: string;
    openAiModel?: string;
    gitAuthorName?: string;
    gitAuthorEmail?: string;
    githubToken?: string;
  };
  converterConfig: unknown;
}

/**
 * note URL を入口に記事変換〜公開までの処理を実行する。
 */
export const runConversion = async (input: RunConversionInput): Promise<string> => {
  const runtimeConfig: RuntimeConfig = loadRuntimeConfig({
    ...input.runtimeConfig,
    analysisMarkdownBasename: input.analysisMarkdownBasename
  });
  const converterConfig = loadConverterConfig(input.converterConfig);

  logStepStart("Initialize");
  const llmClient = await createLlmClient(runtimeConfig);
  logStepEnd("Initialize");

  logStepStart("Fetch");
  const html = await fetchNoteHtml(input.noteUrl);
  logStepEnd("Fetch");

  logStepStart("Analysis");
  const article = analyzeHtml(html, input.noteUrl, runtimeConfig.analysisMarkdownBasename);
  logStepEnd("Analysis");

  logStepStart("Inference");
  const rewritten = await llmClient.rewrite(article.markdown, converterConfig, article.slug);
  logStepEnd("Inference");

  logStepStart("Download / Output");
  await downloadImages(article);
  const articlePath = await writeArticle(article, rewritten, runtimeConfig.zennRepoPath, article.assetDir);
  logStepEnd("Download / Output");

  logStepStart("Copy");
  await copyImagesToZennRepo(article, projectRoot, runtimeConfig.zennRepoPath);
  logStepEnd("Copy");

  logStepStart("Publish");
  await publishToZennRepo(article, runtimeConfig.zennRepoPath, article.assetDir, {
    gitAuthorName: runtimeConfig.gitAuthorName,
    gitAuthorEmail: runtimeConfig.gitAuthorEmail,
    githubToken: runtimeConfig.githubToken
  });
  logStepEnd("Publish");

  return articlePath;
};
