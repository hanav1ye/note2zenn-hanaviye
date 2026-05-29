# note2zenn 導入・作業手順（VSCode 拡張）

## 1. 前提
- VSCode / Cursor が利用可能であること
- OpenAI API キーを用意していること
- Zenn リポジトリをローカルに clone していること

## 2. インストール（開発時）

```bash
cd /c/git/note2zenn-hanaviye
npm install
npm run build
```

F5（**Run Extension**）で Extension Development Host を起動する。

## 3. サイドバーで設定・実行（主な操作）

Activity Bar（左端）の **Note2Zenn** アイコンを開く。

### 変換
- **note URL** / **basename** を入力
- **変換を実行**

### 設定（画面内で保存）
- Zenn リポジトリパス
- OpenAI モデル
- 既定 basename（任意）
- converterConfig（JSON）→ **設定を保存**

### 秘密情報（ボタン → 入力ダイアログ）
- OpenAI Key / GitHub Token / Git 名前 / Git メール  
  → SecretStorage に保存（設定済み/未設定が表示される）

## 4. コマンドパレット（補助）

`Ctrl+Shift+P` → `Note2Zenn` で次も利用可能:
- `Note2Zenn: Open Sidebar` … サイドバーを開く
- `Note2Zenn: Run Conversion` … ダイアログ入力で変換
- 各種 Secret 設定コマンド

## 5. 実行結果
- 画像（作業用）: 拡張ホストのワークスペース `public/images/<basename>/`
- 推論後 Markdown: Zenn リポ `articles/<basename>.md`
- 画像コピー先: Zenn リポ `images/<basename>/`
- `git add` / `commit` / `push`（変更がある場合）

ログ: **Output → Note2Zenn**

## 6. よくある注意点
- `zennRepoPath` は絶対パスで、存在する Zenn リポを指すこと
- OpenAI API キーはサイドバーの **OpenAI Key** から設定
- converterConfig の JSON 構文エラー時は保存されない

## 7. 運用・責任の範囲

[README.md の「注意事項・利用上の前提」](../README.md#注意事項利用上の前提) を参照。
