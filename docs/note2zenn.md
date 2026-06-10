# note2zenn 要件定義・方式設計

note 記事を Zenn 向け Markdown に変換し、画像配置と Git 反映まで行う **VSCode 拡張**の設計書です。

## 0. 免責（必読）

**本ツールの利用により生じる一切のトラブルは、利用者（使用者）の責任に帰属します。**  
提供者は変換品質・公開内容・料金・データ損失等を保証しません。  
全文は [DISCLAIMER.md](DISCLAIMER.md) を参照してください。

## 1. プロジェクト概要

### 1.1 目的

note で公開した記事を、Zenn に投稿しやすい形式（Markdown + 画像 + フロントマター）へ変換し、ローカルの Zenn 用 git リポジトリへ反映するまでを、エディタ上の操作で完結させる。

### 1.2 スコープ内

- note 記事 URL からの HTML 取得と解析
- OpenAI API による本文リライト（文体パラメータ付き）
- 画像のダウンロードと Zenn リポへの配置
- `articles/*.md` の生成（下書き `published: false`）
- 変更がある場合の `git add` / `commit` / `push`

### 1.3 スコープ外（非目標）

- note 公式 API との連携（HTML スクレイピング方式）
- Ollama 等、OpenAI 以外の推論エンジン
- Docker / CLI 単体実行（廃止済み）
- サーバとしての公開・マルチテナント運用
- 変換結果の法的・著作権上の適合性の保証

## 2. システムコンセプト

| コンセプト | 内容 |
|------------|------|
| UI 完結 | サイドバー Webview で設定・秘密情報・変換を行う（`.env` 不要） |
| OpenAI 固定 | 推論は OpenAI Chat Completions のみ |
| アセット移行 | 画像をローカル保存し、本文参照を `/images/{assetDir}/` に統一 |
| 文体制御 | `converterConfig` の数値軸 + 追加指示（`free_instruction`） |
| 一気通貫 | 変換から Zenn リポへのコピー・Git 公開までパイプライン化 |

## 3. アーキテクチャ

### 3.1 構成要素

```
[ユーザー]
    ↓ note URL, basename, 設定
[VSCode 拡張]
  extension.ts / sidebarViewProvider.ts
  conversion/runConversion.ts
  settings/ / validation/ / output/
    ↓
  pipeline.ts
    ↓
  services/*  →  note.com / OpenAI / ローカル FS / git / GitHub
```

### 3.2 データフロー

1. **Initialize** — 設定・Secret・basename を検証し LLM クライアントを準備
2. **Fetch** — note 記事 HTML を HTTP GET
3. **Analysis** — タイトル・本文 Markdown・画像を抽出
4. **Inference** — `system_prompt.txt` + `converterConfig` で OpenAI リライト
5. **Download / Output** — 画像保存、`articles/<assetDir>.md` 生成
6. **Copy** — 画像を Zenn リポ `images/<assetDir>/` へコピー
7. **Publish** — Git で commit / push（ステージ済み差分がなければ何もしない）

### 3.3 設定の置き場所

| 種別 | 保存先 | 例 |
|------|--------|-----|
| 通常設定 | VSCode `note2zenn.*` | `zennRepoPath`, `openAiModel`, `converterConfig` |
| 秘密情報 | SecretStorage | OpenAI API キー、GitHub token、Git author |
| 実行時入力 | サイドバー（またはコマンド） | note URL、basename |

## 4. 機能要件

### 4.1 入力・検証

- note URL は `note.com` ホストを含むこと
- `zennRepoPath`・OpenAI API キー・basename（または既定 basename）が必須

### 4.2 解析（Analysis）

- タイトルから著者名サフィックスを除去
- アイキャッチ・末尾プロフィール画像を本文・DL 対象から除外
- 画像パスを `/images/{assetDir}/filename` に変換
- `figcaption` を alt に反映
- タグは Inference（OpenAI）で生成（Analysis では作らない）

`assetDir` の決定（通常の UI 経由）:

1. サイドバー入力の basename（空なら次へ）
2. 設定 `defaultAnalysisBasename`
3. どちらも無い場合は **エラー**（変換開始前に `validation/conversionInput` で検証）

※ `analysisService` 単体では、basename 未指定時に note の slug へフォールバックする実装がありますが、サイドバー・コマンドパレットからの実行では上記 1〜3 が適用されます。

### 4.3 converterConfig（サイドバー経由の設定）

| タイミング | 挙動 |
|------------|------|
| サイドバーで値を変更 | 4 軸スライダー + `free_instruction` を編集 |
| 変換実行 | 実行直前に現在値を `buildConverterConfigFromForm` で保存し、`loadConverterConfig` で正規化して使用 |
| 不正値が入る場合 | `loadConverterConfig` が欠損・型違いをデフォルト補完し、`value` を 0〜1 に clamp |

- 変換時は **エラーにせず補正して続行**
- `example`（Few-shot）は廃止（`converterConfig` は `value` 系 4 軸 + `free_instruction` を使用）

利用者向けの詳細は [SETUP_AND_WORKFLOW.md §3.3](SETUP_AND_WORKFLOW.md#33-converterconfig文体スライダー)。

### 4.4 推論（Inference）

- OpenAI API のみ。モデルは `note2zenn.openAiModel`（未設定時 `gpt-4.1-mini`）
- `temperature: 0`
- プロンプト: `prompts/system_prompt.txt` + user 側に `converter_config` と記事本文
- 応答は JSON `{ "body": "…", "tags": ["…"] }` を期待。`tags` は記事内容に即した Zenn 向けタグ（最大 5 個、**1タグ＝1単語・ハイフン繋ぎなし**）
- JSON のパースに失敗した場合: 応答全文を本文とみなし、`tags` は空配列（フロントマター `tags: []`）

### 4.5 出力（Output）

- フロントマター: `published: false` 固定（Zenn 上は下書き）
- `type: tech`, `emoji: 📝`（固定値）
- 本文は LLM 出力を後処理（タイトル重複除去、note 末尾タグ除去など）

### 4.6 Git（Publish）

- 対象: `articles/<assetDir>.md`, `images/<assetDir>/`
- commit メッセージ: `add <assetDir>`
- push: ローカルに設定された `origin` を使用
- GitHub Token あり + HTTPS リモート: トークン埋め込み URL で push
- Token なし: 通常の `git push`（SSH 等は利用者環境に依存）

**push は自動実行される。** 利用者が事前に diff を確認する運用を前提とする（免責参照）。

### 4.7 進捗・エラー

- 各ステップの `[START]` / `[END]` を Output チャンネル `Note2Zenn` に出力
- 失敗時はエラー通知 + Output にメッセージ

## 5. 非機能要件

| 項目 | 方針 |
|------|------|
| 実行環境 | 利用者のローカル VSCode / Cursor |
| 秘密情報 | SecretStorage のみ（平文 `.env` は使わない） |
| 責任分界 | 設定・公開判断・権利確認はすべて利用者（[DISCLAIMER.md](DISCLAIMER.md)） |
| 可用性 | ベストエフォート。第三者 API・note HTML 変更に依存 |
| セキュリティ | 脆弱性報告は [SECURITY.md](SECURITY.md) |

## 6. データモデル（主要型）

### ParameterSetting

```typescript
export interface ParameterSetting {
  value: number; // 0.0 〜 1.0
}
```

### ConverterConfig

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

### ParsedArticle

```typescript
export interface ParsedArticle {
  title: string;
  slug: string;       // note 由来（LLM 用）
  assetDir: string;   // ファイル・画像フォルダ名
  markdown: string;
  images: ImageAsset[];
}
```

## 7. ディレクトリ構成（現行）

```
src/
  extension.ts
  sidebarViewProvider.ts
  conversion/runConversion.ts
  settings/ / validation/ / output/
  pipeline.ts
  services/     # fetch, analysis, llm, asset, output, copy, git, config
  types/
  utils/
prompts/system_prompt.txt
public/images/          # 実行時に <assetDir>/ が作成される
media/note2zenn.png
dist/                     # ビルド成果物（VSIX はここを実行）
```

Zenn リポジトリ側（利用者が指定）:

- `articles/<assetDir>.md`
- `images/<assetDir>/`

## 8. 廃止した構成

以下は v2.0（VSCode 拡張化）以降 **存在しません**。

- `src/index.ts`（CLI エントリ）
- `Dockerfile`, `docker-compose.yml`
- `.env.example`
- ルート `converter-config.json`（→ `note2zenn.converterConfig` に統合）

## 9. 関連ドキュメント

| ドキュメント | 内容 |
|--------------|------|
| [SETUP_AND_WORKFLOW.md](SETUP_AND_WORKFLOW.md) | 利用手順 |
| [SOURCE_AND_FLOW.md](SOURCE_AND_FLOW.md) | 実装の詳細 |
| [DISCLAIMER.md](DISCLAIMER.md) | 免責・利用者責任 |
| [SECURITY.md](SECURITY.md) | 脆弱性報告 |
