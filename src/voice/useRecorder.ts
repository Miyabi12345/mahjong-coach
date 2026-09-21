/**
 * 録音（音声入力。Phase 2。2026-09-22）
 *
 * いまはブラウザ版だけ（MediaRecorder）。
 * ⚠️ ブラウザがマイクを使えるのは localhost か https:// のページだけ。
 *    iPhone から http://<PCのIP>:8081 で開いたときは使えない（isSecureContext が false）。
 *    App Store 用のアプリ（EAS ビルド）では expo-audio で録音する予定（Phase 3）。
 * ⚠️ 録音はサーバーに送って文字にするだけ。どこにも保存しない。
 */
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const MAX_SECONDS = 60;   // 長すぎる録音は自動で止める（質問1つは平均8秒だった。1回目の精度テスト）

export type Recording = { blob: Blob; mime: string; seconds: number };

/** 録音できるか。できないなら理由 */
export function recorderUnavailableReason(): string | null {
  if (Platform.OS !== "web") return "アプリ版の音声入力は準備中です";
  if (typeof window === "undefined" || typeof navigator === "undefined") return "音声入力は使えません";
  if (!window.isSecureContext) return "このページでは音声入力を使えません（https か localhost で開いたときだけ）";
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return "このブラウザでは音声入力を使えません";
  }
  return null;
}

/** 録音できる形式（Chrome は webm、Safari は mp4） */
function pickMime(): string {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

export function useRecorder(onDone: (r: Recording) => void, onError: (msg: string) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    rec.current?.stream.getTracks().forEach((t) => t.stop());   // マイクを離す
    rec.current = null;
    setRecording(false);
  };

  useEffect(() => cleanup, []);

  const stop = () => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  };

  const start = async () => {
    const why = recorderUnavailableReason();
    if (why) return onError(why);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        const seconds = (Date.now() - started.current) / 1000;
        const type = r.mimeType || mime || "audio/webm";
        cleanup();
        if (!chunks.length) return onError("録音できませんでした");
        onDone({ blob: new Blob(chunks, { type }), mime: type, seconds });
      };
      rec.current = r;
      started.current = Date.now();
      setElapsed(0);
      r.start();
      setRecording(true);
      timer.current = setInterval(() => {
        const s = (Date.now() - started.current) / 1000;
        setElapsed(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch (e: any) {
      cleanup();
      onError(e?.name === "NotAllowedError" ? "マイクの使用が許可されていません" : `録音を始められませんでした（${e?.message ?? e}）`);
    }
  };

  return { recording, elapsed, start, stop };
}
