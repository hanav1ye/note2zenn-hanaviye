# 設定と使い方

note2zenn を初めて使うときの手順です。  
**使う前に [DISCLAIMER.md](DISCLAIMER.md) を読んでください。** トラブルはすべて利用者の責任です。

## 1. 用意するもの

| もの | 説明 |
|------|------|
| VSCode または Cursor | 拡張を動かすエディタ |
| OpenAI API キー | 記事のリライトに使います（料金がかかります） |
| Zenn 用リポジトリ | 手元に clone したフォルダ |
| Git（任意） | 自動で commit / push するときに必要 |

## 2. 拡張の入れ方

### 開発者向け（このリポジトリから動かす）

```bash
npm install
npm run build
```

VSCode でこのフォルダを開き、**F5**（Run Extension）で「拡張開発ホスト」が起動します。

### VSIX から入れる場合

```bash
npm run package
```

できた `.vsix` を VSCode の「拡張機能: Install from VSIX...」で選びます。

## 3. 初回設定

左の Activity Bar で **Note2Zenn** アイコンをクリックし、サイドバーを開きます。

### 3.1 画面の設定項目（「設定を保存」で保存）

| 項目 | 意味 |
|------|------|
| Zenn リポジトリパス | Zenn 用 git リポジトリの**絶対パス**（例: `C:\git\my-zenn-repo`） |
| OpenAI モデル | 使うモデル名（未入力時は `gpt-4.1-mini`） |
| 既定 basename | 毎回 basename を空にしたときの既定値（任意） |
| converterConfig | 文体の調整用 JSON（下記参照） |

### 3.2 秘密情報（ボタンを押して入力）

| ボタン | 必須 | 用途 |
|--------|------|------|
| OpenAI Key | **必須** | OpenAI API の認証 |
| GitHub Token | 任意 | HTTPS で `git push` するとき |
| Git 名前 / Git メール | 任意 | commit の作者情報（未設定時は既定の bot 名） |

値は **SecretStorage**（VSCode が管理する秘密領域）に保存されます。画面には「設定済み / 未設定」だけ表示されます。

### 3.3 converterConfig（JSON）

サイドバーの JSON は **「設定を保存」** を押したときだけ `note2zenn.converterConfig` に書き込まれます。  
**「変換を実行」ではテキストエリアの内容は読みません**（未保存の編集は反映されません）。

#### 正しい形の例

```json
{
  "logical_density": { "value": 0.7 },
  "technical_focus": { "value": 0.7 },
  "emotional_retention": { "value": 0.6 },
  "politeness_level": { "value": 0.5 },
  "free_instruction": ""
}
```

| キー | 意味 |
|------|------|
| `logical_density` など 4 軸 | 各 `{ "value": 0.0〜1.0 }` で文体の強さ |
| `free_instruction` | 任意。追加の指示（文字列） |
| `options` | 任意。将来用の真偽フラグ（オブジェクト） |

各軸の `value` は変換時に **0.0〜1.0 に丸め**られます。

#### サイドバーで壊したときの挙動

| 操作・入力 | 結果 |
|------------|------|
| **設定を保存** + JSON 構文エラー（カンマ抜け、`{` 不足など） | **保存されない**。ログ欄に `converterConfig の JSON が不正です。` |
| **設定を保存** + 空のテキストエリア | `{}` として保存 |
| **設定を保存** + 構文は正しいが中身がズレている（型違い・軸の欠落など） | **そのまま保存される**（保存時は中身を検証しない） |
| **変換を実行**（保存済みの設定を使用） | 変換開始時に `loadConverterConfig` で補正（欠けた軸はデフォルト、`value` は 0〜1 に clamp）。**エラーにはならず変換は続行** |
| テキストエリアだけ編集して保存せずに変換 | **直前に保存した内容**で変換（画面の未保存 JSON は無視） |

デフォルト値（補完時）: `logical_density` / `technical_focus` = 0.7、`emotional_retention` = 0.6、`politeness_level` = 0.5、`free_instruction` = `""`。

#### 現バージョンの制限

- JSON に `example`（Few-shot の入出力ペア）を書いても、変換時の正規化で **`value` のみが使われ、`example` は渡されません**（型定義上はあるが未対応）。

VSCode の設定画面から編集する場合: コマンドパレット → `Note2Zenn: Open Settings`（挙動は上記と同じです）。

#### その他の設定欄（サイドバー）

| 欄 | 保存時 | 変換時 |
|----|--------|--------|
| Zenn リポジトリパス | 形式チェックなし | 空ならエラーで停止 |
| OpenAI モデル | 形式チェックなし | 空なら `gpt-4.1-mini` |
| 既定 basename | 形式チェックなし | basename 未入力時のフォールバック用 |

## 4. 記事を変換する

1. **note URL** … `https://note.com/...` 形式（`note.com` の記事のみ）
2. **basename** … 保存ファイル名のベース（拡張子なし）。例: `my-article`
3. **変換を実行** をクリック

処理が終わると通知が出ます。ログは **表示 → 出力 → Note2Zenn** で確認できます。

### basename について

- `articles/<basename>.md` というファイル名になります
- 画像は `images/<basename>/` に置かれます
- サイドバーで空にした場合は **「既定 basename」** の設定値を使います
- サイドバーも既定も空の場合は **エラー** になります（変換は開始されません）

## 5. 変換後にできること

| 出力 | 場所 |
|------|------|
| 作業用の画像 | 拡張プロジェクト内 `public/images/<basename>/` |
| 記事 Markdown | Zenn リポ `articles/<basename>.md` |
| 公開用画像 | Zenn リポ `images/<basename>/` |

フロントマターは **`published: false`（下書き）** で出力されます。Zenn 上で公開するかは自分で判断してください。

Git の処理（変更があるときだけ）:

1. `git add`（記事と画像）
2. `git commit`
3. `git push`（GitHub Token があると HTTPS 認証付き）

**push する前に、必ず Zenn リポの差分を目視で確認してください。**

## 6. コマンドパレット（サイドバー以外）

`Ctrl+Shift+P`（Mac は `Cmd+Shift+P`）→ `Note2Zenn` で検索:

| コマンド | 説明 |
|----------|------|
| Open Sidebar | サイドバーを開く |
| Run Conversion | ダイアログで URL と basename を入れて変換 |
| Set OpenAI API Key など | 秘密情報の登録 |
| Open Settings | VSCode 設定を開く |

## 7. うまくいかないとき

| 症状 | 確認すること |
|------|----------------|
| OpenAI API キーがない | サイドバーで OpenAI Key を設定 |
| zennRepoPath がない | Zenn リポの絶対パスを設定して保存 |
| basename がない | サイドバーまたは既定 basename を設定 |
| note が 404 | URL が実在する公開記事か確認 |
| Git 権限エラー | リポのパス・書き込み権限・`safe.directory` |
| converterConfig が保存できない | JSON の構文（カンマ・括弧・引用符）を確認。[§3.3](#33-converterconfigjson) 参照 |
| 変換結果のトーンが想定と違う | converterConfig を保存したか確認。未保存の編集は反映されない |

## 8. 安全のためのおすすめ

- 変換するのは**自分の記事**に限る
- 本番用 Zenn リポへ push する前に **diff を見る**
- GitHub Token は**必要最小限の権限**だけ付ける
- 社内の決まりで禁止されている内容を OpenAI に送らない

技術的な処理の流れは [SOURCE_AND_FLOW.md](SOURCE_AND_FLOW.md)、要件の概要は [note2zenn.md](note2zenn.md) を参照してください。
