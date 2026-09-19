// ===== ウマ・オカのプリセット =====
export type UmaOkaId = "10-20" | "10-30" | "mleague" | "sanma-20" | "sanma-30";

export type UmaOkaPreset = {
  id: UmaOkaId;
  label: string;
  playerCount: 4 | 3;
  uma: number[];
  oka: number;
  note: string;
};

export const UMA_OKA_PRESETS: UmaOkaPreset[] = [
  // --- 4人麻雀（25000点持ち / 30000点返し）---
  { id: "10-20", label: "10-20", playerCount: 4, uma: [20, 10, -10, -20], oka: 20, note: "フリー雀荘で一般的" },
  { id: "10-30", label: "10-30", playerCount: 4, uma: [30, 10, -10, -30], oka: 20, note: "トップの価値が高い" },
  { id: "mleague", label: "50-10-10-30", playerCount: 4, uma: [50, 10, -10, -30], oka: 0, note: "Mリーグ方式。オカなし" },
  // --- 3人麻雀（35000点持ち / 40000点返し）---
  { id: "sanma-20", label: "20-0-20", playerCount: 3, uma: [20, 0, -20], oka: 15, note: "2着は増減なし。標準的な3麻" },
  { id: "sanma-30", label: "30-0-30", playerCount: 3, uma: [30, 0, -30], oka: 15, note: "トップとラスの差が大きい" },
];

export function getPresets(playerCount: 4 | 3): UmaOkaPreset[] {
  return UMA_OKA_PRESETS.filter((p) => p.playerCount === playerCount);
}

export const DEFAULT_UMA_OKA: Record<4 | 3, UmaOkaId> = { 4: "10-20", 3: "sanma-20" };

export const START_POINTS: Record<4 | 3, { start: number; back: number }> = {
  4: { start: 25000, back: 30000 },
  3: { start: 35000, back: 40000 },
};

// ===== チップ =====
export type ChipConfig = {
  enabled: boolean;
  onIppatsu: boolean;
  onAka: boolean;
  onUra: boolean;
  value: number;   // チップ1枚を何点相当と見なすか
};

export const CHIP_VALUE_MIN = 1000;
export const CHIP_VALUE_MAX = 20000;

// テンピン(1000点=100円)で、チップ1枚 100〜500円 が相場。
// 点数に換算すると 1000〜5000点。
export const CHIP_VALUE_PRESETS = [1000, 2000, 3000, 5000];

// ===== 細かいルールの選択肢 =====

/** 連荘方式。電脳麻将: 1=和了連荘, 2=テンパイ連荘 */
export type RenchanId = "tenpai" | "agari";

/** 延長戦。電脳麻将: 0=なし, 1=サドンデス */
export type ExtraGameId = "suddenDeath" | "none";

/** 同時和了。電脳麻将: 1=頭ハネ, 2=ダブロン, 3=トリロン */
export type MultiRonId = "atamahane" | "double" | "triple";

export const RENCHAN_OPTIONS: { id: RenchanId; label: string; note: string }[] = [
  { id: "tenpai", label: "テンパイ連荘", note: "親が和了るか、流局時テンパイで連荘" },
  { id: "agari", label: "和了連荘", note: "親が和了ったときだけ連荘" },
];

export const EXTRA_GAME_OPTIONS: { id: ExtraGameId; label: string; note: string }[] = [
  { id: "suddenDeath", label: "西入りあり", note: "誰も3万点に届かなければ1局ずつ延長" },
  { id: "none", label: "西入りなし", note: "3万点に届かなくてもオーラスで終了" },
];

export const MULTI_RON_OPTIONS: { id: MultiRonId; label: string; note: string }[] = [
  { id: "atamahane", label: "頭ハネ", note: "上家取り。和了は1人だけ" },
  { id: "double", label: "ダブロンあり", note: "2人まで同時に和了できる" },
  { id: "triple", label: "トリロンあり", note: "3人まで同時に和了できる" },
];

// ===== ルール設定 =====
export type RuleConfig = {
  playerCount: 4 | 3;
  length: "tonpu" | "hanchan";

  // 細かいルール
  akaDora: boolean;
  kuitan: boolean;
  kuikae: boolean;          // 喰い替え
  kiriage: boolean;         // 切り上げ満貫
  tsumobanNashiRiichi: boolean;  // ツモ番なしリーチ
  notenSengen: boolean;     // ノーテン宣言
  tochuRyukyoku: boolean;   // 途中流局
  renchan: RenchanId;
  extraGame: ExtraGameId;
  multiRon: MultiRonId;

  // 終了条件
  tobiEnd: boolean;
  agariYame: boolean;

  // 精算
  umaOka: UmaOkaId;
  chip: ChipConfig;

  // 3麻専用（現在は準備中。majiang-core が3人打ちに非対応のため）
  kitaNuki: boolean;
  tsumoLoss: boolean;
};

export const DEFAULT_RULE: RuleConfig = {
  playerCount: 4,
  length: "hanchan",

  akaDora: true,
  kuitan: true,
  kuikae: false,
  kiriage: false,
  tsumobanNashiRiichi: false,
  notenSengen: false,
  tochuRyukyoku: true,
  renchan: "tenpai",
  extraGame: "suddenDeath",
  multiRon: "double",

  tobiEnd: true,
  agariYame: true,

  umaOka: "10-20",
  chip: { enabled: false, onIppatsu: true, onAka: true, onUra: true, value: 1000 },

  kitaNuki: true,
  tsumoLoss: false,
};

/** 3人麻雀は majiang-core が非対応。UIで選べないようにするためのフラグ */
export const SANMA_AVAILABLE = false;

// ===== 目的設定 =====
export type ObjectiveId = "standard" | "mustTop" | "avoidLast" | "tournament";

export type ObjectiveConfig = { id: ObjectiveId; label: string; description: string };

export const OBJECTIVES: ObjectiveConfig[] = [
  { id: "standard", label: "標準", description: "順位点の期待値を最大化する、バランス型の判断" },
  { id: "mustTop", label: "絶対トップ", description: "2着以下は同価値とみなし、トップ率を最大化する" },
  { id: "avoidLast", label: "ラス回避", description: "ラス率と飛びを避けることを最優先する" },
  { id: "tournament", label: "トーナメント", description: "通過条件（目標点差・順位）から逆算して判断する" },
];

export const DEFAULT_OBJECTIVE: ObjectiveId = "standard";

// ===== プレイヤーのレベル =====
export type PlayerLevel = "beginner" | "intermediate" | "advanced";

export const PLAYER_LEVELS: { id: PlayerLevel; label: string; description: string }[] = [
  { id: "beginner", label: "はじめたばかり", description: "役や点数計算がまだあやふや" },
  { id: "intermediate", label: "打ち回しを知りたい", description: "役や点数はわかる。状況判断に自信がない" },
  { id: "advanced", label: "結論だけ知りたい", description: "打ち慣れている。前置きは不要" },
];

export const DEFAULT_LEVEL: PlayerLevel = "intermediate";
// ===== 対局設定 =====
export type MatchConfig = {
  rule: RuleConfig;
  objective: ObjectiveId;
  level: PlayerLevel;
  /**
   * 打牌のあとに ○× を出すか（みやびさんの決定。2026-09-19）
   *   ○ … 手が遠くならない打牌の中で、有効牌が最大
   *   × … それ以外
   * 打点・安全度・AI推奨は見ていない。判定はサーバー（engine.js）が行う。
   */
  showRating: boolean;
};
export const DEFAULT_MATCH: MatchConfig = {
  rule: DEFAULT_RULE,
  objective: DEFAULT_OBJECTIVE,
  level: DEFAULT_LEVEL,
  showRating: true,
};

// ===== サーバーに送る形に変換する =====
// 電脳麻将のルールキーへの対応は engine.js 側で行うため、
// ここではアプリ側の設定をそのまま送る。
export function toServerRule(rule: RuleConfig) {
  return { ...rule };
}

