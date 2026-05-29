import fs from "node:fs/promises";
import path from "node:path";
import { ParsedArticle } from "../types/article.js";

/**
 * 出力先ディレクトリを作成してからファイルコピーを行う。
 * @param src コピー元パス
 * @param dest コピー先パス
 */
const copyFileSafe = async (src: string, dest: string): Promise<void> => {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
};

/**
 * 本リポジトリ `public/images/<slug>/` の画像を Zenn リポジトリへコピーする。
 * 記事 Markdown は `writeArticle` で Zenn リポジトリに直接出力済み。
 * @param article 解析済み記事データ
 * @param projectRoot 本プロジェクトルート
 * @param zennRepoPath Zennリポジトリパス
 */
export const copyImagesToZennRepo = async (
  article: ParsedArticle,
  projectRoot: string,
  zennRepoPath: string
): Promise<void> => {
  const sourceImageDir = path.join(projectRoot, "public", "images", article.assetDir);
  const imageFiles = await fs.readdir(sourceImageDir);
  for (const imageFile of imageFiles) {
    const src = path.join(sourceImageDir, imageFile);
    const dest = path.join(zennRepoPath, "images", article.assetDir, imageFile);
    await copyFileSafe(src, dest);
  }
};
