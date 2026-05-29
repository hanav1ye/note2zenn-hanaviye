# note2zenn 要件定義・方式設計書 (v2.0)

note 記事を、Zenn に投稿可能な Markdown・画像・Git 反映まで自動化する **VSCode 拡張**。

## 1. プロジェクト概要

note 記事を OpenAI API で Zenn 向けに最適化し、記事・画像の配置と Git 公開まで実行する。  
「設定は GUI で完結」「OpenAI 固定」「運用自動化」をコア価値とする。

## 2. システムコンセプト

- **拡張 UI 完結**: サイドバー Webview で設定・秘密情報・変換実行を行う（ソース編集不要）。
- **OpenAI 固定**: 推論は OpenAI API のみ（Ollama / CLI / Docker は廃止）。
- **アセット完全移行**: 画像をローカルへ保存し、本文参照を `/images/{basename}/filename` に統一。
- **独自性の継承**: `note2zenn.converterConfig` の数値 + Few-shot で文体制御。
- **運用一気通貫**: 変換後は Zenn リポジトリへコピーし、`Publish` で `git add/commit/push` まで実行。

## 3. 実行方式（アーキテクチャ）

### 3.1 構成

- **VSCode 拡張**: Activity Bar の Note2Zenn サイドバーが主 UI
- **コアパイプライン**: `src/pipeline.ts` + `src/services/*`（Fetch〜Publish）
- **設定**: VSCode 設定（`note2zenn.*`）+ SecretStorage（API キー・Git 情報）

### 3.2 データフロー

1. **Initialize**: サイドバー入力（note URL / basename）と設定・SecretStorage を検証
2. **Fetch**: note 記事 HTML を取得
3. **Analysis**: タイトル正規化、画像 URL 抽出（見出し・末尾画像除外）、技術タグ抽出
4. **Inference**: `ConverterConfig` + system prompt を OpenAI に渡してリライト
5. **Download / Output**: 画像保存、本文後処理、フロントマター付き Markdown 出力
6. **Copy**: Zenn リポジトリへ画像をコピー
7. **Publish**: `git add/commit/push` を自動実行（差分なし時はスキップ）

### 3.3 設定の置き場所

| 種別 | 保存先 | 例 |
|------|--------|-----|
| 通常設定 | VSCode 設定 `note2zenn.*` | `zennRepoPath`, `openAiModel`, `converterConfig` |
| 秘密情報 | SecretStorage | OpenAI API キー、GitHub token、Git author |
| 実行時入力 | サイドバー | note URL、basename |

## 4. 機能要件

- **推論エンジン**: OpenAI API 固定（モデル名は `note2zenn.openAiModel` で指定）
- **画像パスの置換**: `/images/{basename}/filename` 形式への自動リネームと置換
- **見出し画像除外**: note のアイキャッチを本文・ダウンロード対象から除外
- **末尾画像除外**: 記事末尾のプロフィール等画像を DOM / Markdown から除去
- **キャプションの Alt 反映**: `figcaption` のテキストを画像の Alt テキストに反映
- **Zenn 最適化**: `published: false`（下書き）固定、note のタグを Zenn 形式へ変換
- **Git 反映**: 設定した Zenn リポジトリへ commit / push（token 設定時は HTTPS 認証）
- **進捗管理**: 各ステップの開始・終了ログ（Output チャンネル `Note2Zenn`）

## 5. 共通仕様

- 各ステップでの進捗ログ出力
- 異常時はエラーメッセージを通知し、Output に詳細を記録

## 6. プロジェクト構造と定義ファイル

### 6.1 ディレクトリと主要ファイル

- `/src/extension.ts`（拡張エントリ）
- `/src/sidebarViewProvider.ts`（サイドバー Webview）
- `/src/note2zennController.ts`（設定・SecretStorage・実行制御）
- `/src/pipeline.ts`（変換パイプライン）
- `/src/services/*`（Fetch / Analysis / LLM / Output / Copy / Git）
- `/prompts/system_prompt.txt`（system prompt）
- `/public/images`（ダウンロード画像の作業用。Zenn リポへコピー）
- Zenn リポジトリ側: `articles/`（推論後 Markdown）、`images/`

### 6.2 主要データモデル（TypeScript）

#### ParameterSetting

各パラメータの強度と、AI に「目盛り」を教えるための実例（Few-shot）を管理する。

```typescript
export interface FewShotExample {
  input: string;
  output: string;
}

export interface ParameterSetting {
  value: number;
  example?: FewShotExample[];
}
```

#### ConverterConfig（多変量パラメータ管理）

VSCode 設定 `note2zenn.converterConfig` に保持する。

```typescript
export interface ConverterConfig {
  logical_density: ParameterSetting;
  technical_focus: ParameterSetting;
  emotional_retention: ParameterSetting;
  politeness_level: ParameterSetting;
  free_instruction?: string;
  options?: { [key: string]: boolean };
}
```

## 7. 運用・保守

- **非破壊原則**: AI は原文の事実と体験を 100% 維持する。
- **秘密情報**: API キー・トークンは SecretStorage のみ。平文ファイルに保存しない。
