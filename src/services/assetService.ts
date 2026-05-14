import axios from "axios";
import fs from "node:fs/promises";
import path from "node:path";
import { ParsedArticle } from "../types/article.js";
import { publicImagesDir } from "../utils/paths.js";

/**
 * 記事内の画像をローカルへダウンロードする。
 * @param article 解析済み記事データ
 */
export const downloadImages = async (article: ParsedArticle): Promise<void> => {
  const targetDir = path.join(publicImagesDir, article.slug);
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
