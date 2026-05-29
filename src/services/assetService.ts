import axios from "axios";
import fs from "node:fs/promises";
import path from "node:path";
import { ParsedArticle } from "../types/article.js";
import { publicImagesDir } from "../utils/paths.js";

/**
 * 記事内の画像を指定ベースディレクトリ配下へダウンロードする。
 * @param article 解析済み記事データ
 * @param imagesBaseDir 画像保存の親ディレクトリ
 * @param imageSubDir 親直下のサブディレクトリ名（省略時は `article.assetDir`）
 */
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
