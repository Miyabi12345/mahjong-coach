import { DEFAULT_MATCH, MatchConfig } from "../types/config";

// 画面をまたいで設定を保持する簡易ストア
// 将来的にはZustandなどに置き換えます
let current: MatchConfig = { ...DEFAULT_MATCH };

export function getMatchConfig(): MatchConfig {
  return current;
}

export function setMatchConfig(config: MatchConfig) {
  current = config;
}