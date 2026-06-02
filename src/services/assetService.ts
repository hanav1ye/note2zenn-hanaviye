/**
 * 解析結果の画像を一時保存（Download ステップ）。
 *
 * public/images/<assetDir>/ にダウンロードし、
 * 後段の copyService で Zenn リポの images/ へコピーする。
 */
import axios from "axios";
import fs from "node:fs/promises";
import path from "node:path";
import { ParsedArticle } from "../types/article.js";
import { publicImagesDir } from "../utils/paths.js";

export const downloadImages = async (
  article: ParsedArticle,
  imagesBaseDir: string = publicImagesDir,
  imageSubDir: string = article.assetDir
): Promise<void> => {
  if (article.images.length === 0) {
    return;
  }

  const targetDir = path.join(imagesBaseDir, imageSubDir);
  await fs.mkdir(targetDir, { recursive: true });

  for (const image of article.images) {
    try {
      const response = await axios.get<ArrayBuffer>(image.originalUrl, {
        responseType: "arraybuffer",
        timeout: 20000
      });
      const filePath = path.join(targetDir, image.localFileName);
      await fs.writeFile(filePath, Buffer.from(response.data));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown download error";
      throw new Error(`Image download failed: url=${image.originalUrl}, reason=${message}`);
    }
  }
};
