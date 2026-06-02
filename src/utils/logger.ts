/**
 * パイプライン各ステップの進捗ログ。
 * pipeline.ts から [START] / [END] 形式で出力する。
 */
export const logStepStart = (stepName: string): void => {
  console.log(`[START] ${stepName}`);
};

export const logStepEnd = (stepName: string): void => {
  console.log(`[END] ${stepName}`);
};
