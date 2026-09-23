/**
 * アプリの入口。
 * 同意（データの取り扱い）は、アプリ版では読み書きが非同期なので、ここで1回読んでから画面を出す（2026-09-23）。
 * 読み終わるまでは何も出さない（すぐ終わる）。
 */
import { Stack } from "expo-router";
import { useEffect, useState } from "react";

import { loadConsent } from "../consent/consent";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadConsent().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
