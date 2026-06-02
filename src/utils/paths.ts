/**
 * 拡張内で参照するパス定数。
 *
 * ESM の import.meta.url から拡張ルートを求め、
 * 画像一時保存先・system prompt の位置を決める。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);

/** 拡張プロジェクトのルート（public/images の親） */
export const projectRoot: string = path.resolve(__dirname, "../..");

/** 画像ダウンロードの一時保存先: public/images/ */
export const publicImagesDir: string = path.join(projectRoot, "public", "images");

/** LLM system prompt: prompts/system_prompt.txt */
export const promptPath: string = path.join(projectRoot, "prompts", "system_prompt.txt");
