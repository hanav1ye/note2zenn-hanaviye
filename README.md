# note2zenn

note の記事を、Zenn 用の Markdown に直す **VSCode 拡張**です。  
画像の取得、OpenAI による文章の調整、Zenn 用フォルダへの保存、`git push`（任意）まで行います。

## 使い方（ざっくり）

1. 拡張を入れて起動する（開発時は `npm install && npm run build` のあと F5）
2. 左の **Note2Zenn** サイドバーを開く
3. 設定を保存し、OpenAI の API キーなどを登録する
4. **note の URL** と **basename** を入れて **変換を実行**

くわしい手順は [docs/SETUP_AND_WORKFLOW.md](docs/SETUP_AND_WORKFLOW.md) を見てください。

## 注意（必ず読んでください）

**このツールを使って起きた問題は、すべてあなた（利用者）の責任です。**

変換ミス、誤った公開、API 料金、キーの漏れ、著作権の問題など、提供者は結果を保証しません。  
くわしくは [docs/DISCLAIMER.md](docs/DISCLAIMER.md) を読んでから使ってください。

- 原則、**自分の記事**だけを対象にする
- **push の前に** できあがりを必ず確認する
- 記事の本文は **OpenAI に送られます**

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [docs/SETUP_AND_WORKFLOW.md](docs/SETUP_AND_WORKFLOW.md) | 設定と実行の手順 |
| [docs/SOURCE_AND_FLOW.md](docs/SOURCE_AND_FLOW.md) | ソースコードと処理の流れ |
| [docs/note2zenn.md](docs/note2zenn.md) | 要件・方式設計 |
| [docs/DISCLAIMER.md](docs/DISCLAIMER.md) | 免責・利用者の責任 |
| [docs/SECURITY.md](docs/SECURITY.md) | セキュリティ・脆弱性の報告 |

## ライセンス

[MIT License](LICENSE)（ソフトウェア本体のライセンス。記事コンテンツの権利は別です。）
