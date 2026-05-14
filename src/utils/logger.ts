/**
 * 処理ステップの開始ログを出力する。
 * @param stepName ステップ名
 */
export const logStepStart = (stepName: string): void => {
  console.log(`[START] ${stepName}`);
};

/**
 * 処理ステップの終了ログを出力する。
 * @param stepName ステップ名
 */
export const logStepEnd = (stepName: string): void => {
  console.log(`[END] ${stepName}`);
};
