/**
 * Analysis ステップの出力データモデル。
 *
 * ParsedArticle … タイトル・本文 Markdown・画像一覧
 * ImageAsset … 各画像の元 URL と Zenn 内参照パス
 */

/**
 * 画像アセットの保存先情報を保持するデータモデル。
 */
export interface ImageAsset {
  /** 元記事上の画像URL。 */
  originalUrl: string;
  /** ローカル保存時のファイル名。 */
  localFileName: string;
  /** Zenn向け Markdown 内の参照パス（例: `/images/<assetDir>/1.png`）。 */
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
  /** note 由来のスラッグ（LLM プロンプト等）。 */
  slug: string;
  /**
   * 画像ディレクトリ名（`images/` 直下）および Markdown ファイル名ベース。
   * basename 未指定時は `slug` と同じ。
   */
  assetDir: string;
  /** Zenn向け本文Markdown（推論・公開パイプライン用。`/images/<assetDir>/` 参照）。 */
  markdown: string;
  /** 記事に含まれる画像アセット一覧。 */
  images: ImageAsset[];
}
