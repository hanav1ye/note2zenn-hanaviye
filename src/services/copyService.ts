/**
 * 作業用画像を Zenn リポジトリへコピー（Copy ステップ）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ParsedArticle } from "../types/article.js";

const copyFileSafe = async (src: string, dest: string): Promise<void> => {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
};

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
