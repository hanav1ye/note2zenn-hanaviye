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
 * 生成した記事と画像をZenn管理リポジトリへコピーする。
 * 画像は本文の `/images/<slug>/...` 参照に合わせて `images/` 配下へ配置する。
 * @param article 解析済み記事データ
 * @param articlePath 生成済み記事ファイルパス
 * @param projectRoot 本プロジェクトルート
 * @param zennRepoPath Zennリポジトリパス
 */
export const copyToZennRepo = async (
  article: ParsedArticle,
  articlePath: string,
  projectRoot: string,
  zennRepoPath: string
): Promise<void> => {
  const destArticle = path.join(zennRepoPath, "articles", `${article.slug}.md`);
  await copyFileSafe(articlePath, destArticle);

  const sourceImageDir = path.join(projectRoot, "public", "images", article.slug);
  const imageFiles = await fs.readdir(sourceImageDir);
  for (const imageFile of imageFiles) {
    const src = path.join(sourceImageDir, imageFile);
    const dest = path.join(zennRepoPath, "images", article.slug, imageFile);
    await copyFileSafe(src, dest);
  }
};
