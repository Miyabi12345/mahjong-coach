/**
 * 録音（音声入力）のアプリ版（iPhone・Android。2026-09-23）
 *
 * ブラウザ版は useRecorder.web.ts（MediaRecorder）。どちらを使うかは Metro が拡張子で選ぶ。
 * アプリ版は expo-audio で録音し、できたファイルを base64 にしてサーバーへ送る。
 *   ⚠️ React Native の fetch は、ファイルをそのまま体（body）に入れて送れないので base64 にする。
 *      サーバー（mahjong-api）は、体が JSON なら base64 として受け取る
 * ⚠️ 録音はサーバーに送って文字にするだけ。端末にもサーバーにも残さない（送った後にファイルを消す）
 * ⚠️ マイクの許可の説明文は app.json の NSMicrophoneUsageDescription
 */
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 60;   // 長すぎる録音は自動で止める（ブラウザ版と同じ）

export type Recording = { mime: string; seconds: number; blob?: Blob; base64?: string };

/** 録音できるか。できないなら理由（アプリ版はいつでも使える。許可は押したときに聞く） */
export function recorderUnavailableReason(): string | null {
  return null;
}

export function useRecorder(onDone: (r: Recording) => void, onError: (msg: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const busy = useRef(false);

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const stop = async () => {
    if (!recording || busy.current) return;
    busy.current = true;
    clearTimer();
    setRecording(false);
    const seconds = (Date.now() - started.current) / 1000;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        onError("録音できませんでした");
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      // 録音は残さない（消せなくても先に進む）
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        /* 消せなくても文字起こしは続ける */
      }
      if (!base64) {
        onError("録音できませんでした");
        return;
      }
      onDone({ base64, mime: "audio/m4a", seconds });
    } catch (e: any) {
      onError(`録音を止められませんでした（${e?.message ?? e}）`);
    } finally {
      busy.current = false;
    }
  };

  const start = async () => {
    if (recording || busy.current) return;
    busy.current = true;
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        onError("マイクの使用が許可されていません");
        return;
      }
      // 録音するには、このモードにする必要がある（iOS）
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      started.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const s = (Date.now() - started.current) / 1000;
        setElapsed(s);
        if (s >= MAX_SECONDS) void stop();
      }, 250);
    } catch (e: any) {
      onError(`録音を始められませんでした（${e?.message ?? e}）`);
    } finally {
      busy.current = false;
    }
  };

  return { recording, elapsed, start, stop };
}
