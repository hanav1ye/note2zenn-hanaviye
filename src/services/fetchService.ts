/**
 * note 記事 URL から HTML を取得（Fetch ステップ）。
 */
import axios from "axios";

/** 15 秒タイムアウト付きで note 記事 HTML を GET する */
export const fetchNoteHtml = async (url: string): Promise<string> => {
  try {
    const response = await axios.get<string>(url, {
      responseType: "text",
      timeout: 15000
    });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText ?? "";
      // 404 は URL 誤り・非公開・削除の可能性が高いのでメッセージを分ける
      if (status === 404) {
        throw new Error(
          `note URL returned 404. Use a real article URL (not placeholders like xxx/n/yyy). url=${url}`
        );
      }
      throw new Error(`note fetch failed: ${status ?? "?"} ${statusText} url=${url}`);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`note fetch failed: ${message} url=${url}`);
  }
};
