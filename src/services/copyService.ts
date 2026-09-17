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

/** 未作成の一時ディレクトリ（画像0枚の記事）は空扱いにする */
const readImageDirSafe = async (dirPath: string): Promise<string[]> => {
  try {
    return await fs.readdir(dirPath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

export const copyImagesToZennRepo = async (
  article: ParsedArticle,
  projectRoot: string,
  zennRepoPath: string
): Promise<void> => {
  if (article.images.length === 0) {
    console.log("[INFO] No images to copy.");
    return;
  }

  const sourceImageDir = path.join(projectRoot, "public", "images", article.assetDir);
  const imageFiles = await readImageDirSafe(sourceImageDir);
  if (imageFiles.length === 0) {
    console.log("[INFO] No images to copy.");
    return;
  }

  for (const imageFile of imageFiles) {
    const src = path.join(sourceImageDir, imageFile);
    const dest = path.join(zennRepoPath, "images", article.assetDir, imageFile);
    await copyFileSafe(src, dest);
  }
};
