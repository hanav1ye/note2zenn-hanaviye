import axios from "axios";

/**
 * note記事のHTMLを取得する。
 * @param url 取得対象URL
 * @returns HTML文字列
 * @throws {Error} HTTPエラー時（404はURL誤り・非公開・削除の可能性を明示）
 */
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
