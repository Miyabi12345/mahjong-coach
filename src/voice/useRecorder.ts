/**
 * 録音（音声入力）の入口
 *
 * 中身は2つに分かれている。どちらを使うかは Metro が拡張子で選ぶ。
 *   useRecorder.web.ts    … ブラウザ版（MediaRecorder）
 *   useRecorder.native.ts … アプリ版（expo-audio）
 * ここはその型を決めるだけ（TypeScript の読み込み先）。
 */
export type { Recording } from "./useRecorder.web";
export { recorderUnavailableReason, useRecorder } from "./useRecorder.web";
