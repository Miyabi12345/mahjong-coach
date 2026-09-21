/**
 * サーバー（mahjong-api）の場所
 *
 * 次の順で決める。
 *   1. 環境変数 EXPO_PUBLIC_API_URL があれば、それを使う
 *      （本番のサーバーや、iPhone のアプリで試すとき。Expo の標準のやり方。
 *       ⚠️ process.env.EXPO_PUBLIC_API_URL とそのまま書かないと値が入らない）
 *   2. ブラウザで開いているなら、開いているページと同じ PC の 8000 番
 *      （iPhone の Safari で http://192.168.x.x:8081 を開いたとき、
 *       サーバーも自動で http://192.168.x.x:8000 になる。2026-09-21 に追加）
 *   3. それ以外は、これまでどおり http://localhost:8000
 */
function pickApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = typeof window !== "undefined" ? window.location?.hostname : undefined;
  if (host) return `http://${host}:8000`;
  return "http://localhost:8000";
}

export const API_BASE = pickApiBase();
