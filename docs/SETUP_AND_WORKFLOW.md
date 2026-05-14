# note2zenn 導入・作業手順

## 1. 前提
- Docker Desktop が起動していること
- `.env` に必要な値を設定していること
  - `LLM_PROVIDER=ollama` または `LLM_PROVIDER=openai`
  - `HOST_ZENN_REPO_PATH` を設定（例: `C:\git\zenn-contents`）
  - `ZENN_REPO_PATH=/zenn-contents` を設定（コンテナ内マウント先）
  - OpenAI利用時は `OPENAI_API_KEY` を設定
  - 自動 push を有効にする場合は `GITHUB_TOKEN` を設定（推奨）

## 2. 初回導入

### 2.1 ローカルLLM（Ollama）を使う場合
```bash
docker compose --profile local-llm up --build
```

- 初回は `gemma4:E2B` の pull に時間がかかります（数十分の可能性あり）
- 完了後は `Ctrl + C` で停止して問題ありません

### 2.2 OpenAIを使う場合（Ollama不要）
```bash
docker compose up --build
```

## 3. 次回以降の起動（pull済み）

### 3.1 ローカルLLM（Ollama）を使う場合
```bash
docker compose --profile local-llm up -d
```

### 3.2 OpenAIを使う場合
```bash
docker compose up -d
```

> `--build` は、Dockerfileや依存関係を更新したときだけ必要です。

## 4. 記事変換の実行

`NOTE_URL` は `.env` ではなく CLI 引数で渡します。
実行はコンテナ経由に統一します。

### 4.1 Dockerで1回実行
```bash
docker compose run --rm app npm run dev -- "https://note.com/hanaviye/n/n8a766cfc8273"
```

## 5. 実行結果
- 生成Markdown: `articles/<slug>.md`
- 画像: `public/images/<slug>/`
- 指定した Zenn リポジトリへ記事・画像をコピー
  - 記事: `articles/<slug>.md`
  - 画像: `images/<slug>/`
- `Publish` フェーズで `git add` / `git commit` / `git push` を自動実行
  - 変更がない場合は自動でスキップ
  - `GITHUB_TOKEN` がある場合は HTTPS push をトークン認証で実行

## 6. ログ確認
```bash
docker compose logs -f ollama
```

## 7. 停止

### 7.1 OpenAI構成
```bash
docker compose down
```

### 7.2 ローカルLLM構成
```bash
docker compose --profile local-llm down
```

## 8. よくある注意点
- `app` は待機コンテナです。変換処理は `docker compose run --rm app ...` で実行します
- URL は毎回 CLI 引数で渡してください
- OpenAI利用時は `LLM_PROVIDER=openai` と `OPENAI_API_KEY` が必須です
- コピー先は `HOST_ZENN_REPO_PATH` を `ZENN_REPO_PATH` で指定したコンテナ内パスへマウントして利用します
- OpenAIで単発実行する場合は `docker compose run --rm -e LLM_PROVIDER=openai app npm run dev -- "<URL>"` を利用できます
- `git push` で認証エラーが出る場合は `.env` に `GITHUB_TOKEN` を追加してください
