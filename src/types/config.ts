/**
 * 変換パラメータの値とFew-shot例を保持する設定単位。
 */
export interface FewShotExample {
  /** 変換前テキスト */
  input: string;
  /** 変換後テキスト */
  output: string;
}

/**
 * 変換パラメータの値とFew-shot例を保持する設定単位。
 */
export interface ParameterSetting {
  /** パラメータの強度 (0.0 〜 1.0) */
  value: number;
  /** ユーザー定義のFew-shot（入力→出力ペア、任意） */
  example?: FewShotExample[];
}

/**
 * 記事変換時の多変量設定。
 */
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

/**
 * 実行時に必要な環境設定。
 */
export interface RuntimeConfig {
  /** OpenAI APIキー。 */
  openAiApiKey: string;
  /** OpenAIで使用するモデル名。 */
  openAiModel: string;
  /** Zennローカルリポジトリの絶対パス。 */
  zennRepoPath: string;
  /**
   * `articles/` の Markdown ファイル名と `images/` 配下フォルダ名のベース（拡張子なし）。
   * `.env` の `ANALYSIS_MARKDOWN_BASENAME`。未設定時は記事スラッグ。
   */
  analysisMarkdownBasename?: string;
  /** Git commit author name. */
  gitAuthorName?: string;
  /** Git commit author email. */
  gitAuthorEmail?: string;
  /** GitHub token for push authentication. */
  githubToken?: string;
}
