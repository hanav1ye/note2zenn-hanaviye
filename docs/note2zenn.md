# note2zenn 要件定義・方式設計書 (v1.5)

note記事を、Zennに投稿可能なMarkdown・画像・Git反映まで自動化する。

## 1. プロジェクト概要
note記事を AI（Local LLM / OpenAI）でZenn向けに最適化し、記事・画像の配置とGit公開まで実行するCLIツール。  
「ローカルLLM優先」「外部API切替可能」「運用自動化」をコア価値とする。

## 2. システムコンセプト
- **ローカル優先**: 標準は Ollama + `gemma4:E2B`。必要時に OpenAI へ切替可能。
- **アセット完全移行**: 画像をローカルへ保存し、本文参照を `/images/{slug}/filename` に統一。
- **独自性の継承**: `converter-config.json` の数値 + Few-shot で文体制御。
- **運用一気通貫**: 変換後はZennリポジトリへコピーし、`Publish` で `git add/commit/push` まで実行。

## 3. 実行方式（アーキテクチャ）

### 3.1 コンテナ構成
Docker Compose を用いたサービス構成。
- **app**: Node.js + TypeScript（常駐待機、`docker compose run --rm app ...` で単発実行）
- **ollama**: ローカル推論サーバー（`local-llm` プロファイル時のみ起動）
- **ollama-init**: 起動時に `gemma4:E2B` を `pull`

### 3.2 データフロー
1. **Initialize**: 環境変数とCLI引数（note URL）を検証し、`converter-config.json` をロード  
2. **Fetch**: note記事HTMLを取得  
3. **Analysis**: タイトル正規化、画像URL抽出、技術タグ抽出  
4. **Inference**: `ConverterConfig` + fixed constraints をLLMに渡してリライト  
5. **Download / Output**: 画像保存、本文後処理、フロントマター付きMarkdown出力  
6. **Copy**: Zennリポジトリへ記事・画像をコピー  
7. **Publish**: `git add/commit/push` を自動実行（差分なし時はスキップ）

## 4. 機能要件
- **推論エンジンの切り替え**: 環境変数により、1つのコードベースで Ollama/OpenAI を切替。
- **ローカルLLMモデル固定**: Ollama 利用時の標準モデルは `gemma4:E2B` とする。
- **画像パスの置換**: `/images/[slug]/filename` 形式への自動リネームと置換。
- **キャプションのAlt反映**: `figcaption` のテキストを画像のAltテキストに反映。
- **Zenn最適化**: `published: false`（下書き）固定、noteのタグをZenn形式へ変換。
- **Git反映**: Zenn用のリポジトリに反映する。.envにそのパスは設定される。
- **進捗管理**: 各ステップでの進捗ログ出力

## 5. 共通仕様
- 各ステップでの進捗ログ出力。
- 異常発生時の即時停止（エラーハンドリング）。

## 6. プロジェクト構造と定義ファイル

### 6.1 ディレクトリと主要ファイル
- `/src`（types / services / utils / index.ts）
- `/prompts/system_prompt.txt`（system prompt）
- `/converter-config.json`（ユーザー調整パラメータ）
- `/articles`（生成Markdown）
- `/public/images`（ダウンロード画像）
- `docker-compose.yml`（app/ollama/ollama-init, profiles, healthcheck）
- `.env`（`LLM_PROVIDER`, `OLLAMA_URL`, `HOST_ZENN_REPO_PATH`, `ZENN_REPO_PATH`, `GITHUB_TOKEN` など）

### 6.2 主要データモデル（TypeScript）

#### ParameterSetting
各パラメータの強度と、AIに「目盛り」を教えるための実例（Few-shot）を管理する。

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

#### ConverterConfig (多変量パラメータ管理)
以下の4項目をメインパラメータとして `ParameterSetting` 型で扱う。

```typescript
export interface ConverterConfig {
  /** 論理的・結論優先の度合い */
  logical_density: ParameterSetting;
  /** 技術用語やコード解説の度合い */
  technical_focus: ParameterSetting;
  /** 筆者の感想や情緒的表現の度合い */
  emotional_retention: ParameterSetting;
  /** 丁寧語（です・ます）を強制する度合い */
  politeness_level: ParameterSetting;

  /** ユーザーからの追加指示（自由記述） */
  free_instruction?: string;
  /** 将来的な拡張オプション（技術用語解説の付加等） */
  options?: { [key: string]: boolean };
}
```

## 7. 運用・保守
- **非破壊原則**: AIは原文の事実と体験を100%維持する。