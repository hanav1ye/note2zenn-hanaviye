import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 現在ファイルの絶対パス。
 * @constant
 */
const __filename: string = fileURLToPath(import.meta.url);
/**
 * 現在ファイルのディレクトリパス。
 * @constant
 */
const __dirname: string = path.dirname(__filename);

/**
 * プロジェクトルート。
 * @constant
 */
export const projectRoot: string = path.resolve(__dirname, "../..");
/**
 * 記事Markdownの出力先ディレクトリ。
 * @constant
 */
export const articlesDir: string = path.join(projectRoot, "articles");
/**
 * 画像アセットの保存先ディレクトリ。
 * @constant
 */
export const publicImagesDir: string = path.join(projectRoot, "public", "images");
/**
 * システムプロンプトファイルの絶対パス。
 * @constant
 */
export const promptPath: string = path.join(projectRoot, "prompts", "system_prompt.txt");
/**
 * 変換パラメータJSONの絶対パス。
 * @constant
 */
export const converterConfigPath: string = path.join(projectRoot, "converter-config.json");
