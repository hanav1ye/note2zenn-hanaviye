/**
 * 画像アセットの保存先情報を保持するデータモデル。
 */
export interface ImageAsset {
  /** 元記事上の画像URL。 */
  originalUrl: string;
  /** ローカル保存時のファイル名。 */
  localFileName: string;
  /** Markdown内で参照するローカル公開パス。 */
  localPath: string;
  /** 画像の代替テキスト。 */
  altText: string;
}

/**
 * note記事を解析した結果を保持するデータモデル。
 */
export interface ParsedArticle {
  /** 記事タイトル。 */
  title: string;
  /** URL/ファイル名に利用するスラッグ。 */
  slug: string;
  /** 本文Markdown。 */
  markdown: string;
  /** Zenn用に正規化したタグ一覧。 */
  tags: string[];
  /** 記事に含まれる画像アセット一覧。 */
  images: ImageAsset[];
}
