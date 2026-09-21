import type { PlayerLevel, RuleConfig } from "../types/config";
import { getConsent } from "../consent/consent";

import { API_BASE } from "./base";

export type Candidate = {
  discard: string;
  shanten: number;
  accepts: string[];
  acceptCount: number;

  // 危険度。他家のリーチがある場合だけ入る
  danger?: number;        // 電脳麻将の内部値。放銃率ではない
  dangerLabel?: string;   // 「かなり安全」「やや危険」など
  dangerRate?: number;    // 放銃率（％）。実測値
};

/** 安全な牌の一覧（安全な順） */
export type SafeTile = {
  discard: string;
  danger: number;
  label: string;
  rate: number | null;
};

export type DangerInfo = {
  /** 危険度が計算できたか。誰もリーチしていなければ false */
  available: boolean;
  /** リーチしている人の位置（その局の親が0） */
  riichiFrom: number[];
  safest: SafeTile[] | null;
  /** 河を何枚流し込めたか（不具合の切り分け用） */
  riverFed: number;
  riverSkipped: number;
};

export type AskResult = {
  answer: string;
  recommended: string;
  riichi: boolean;
  rating: string;
  candidates: Candidate[];
  danger?: DangerInfo;
};

/**
 * 河（捨て牌）の1枚
 *
 * 切られた順に並べる。
 *
 *   l       … その局の親を0とした位置。自分の位置は (4 - jushu) % 4
 *   p       … 牌（"1m" や "東" などアプリの表記）
 *   riichi  … リーチ宣言牌なら true
 *   tsumogiri … ツモ切りなら true（表示用。計算には使われない）
 *
 * ⚠️ l は「座席」ではなく「その局の親からの位置」。
 *    東1局なら自分は0、東2局なら自分は3になる。
 */
export type RiverTile = {
  l: number;
  p: string;
  riichi?: boolean;
  tsumogiri?: boolean;
};

export type AskParams = {
  hand: string[];
  draw: string;
  discard: string;
  question: string;

  // 対局設定。サーバー側の計算とプロンプトに使われる
  rule: RuleConfig;
  level: PlayerLevel;
  objective?: string;

  // 局面
  zhuangfeng?: number;   // 場風 0=東 1=南
  jushu?: number;        // 局数 0=1局目
  honba?: number;
  kyotaku?: number;
  isOya?: boolean;
  menfeng?: number;
  junme?: number;
  remaining?: number;
  baopai?: string;
  defen?: number[];
  opponents?: {
    name: string;
    riichi?: boolean;
    riichiJunme?: number;
    fulou?: string[];
  }[];

  /**
   * 河。これを送ると危険度が計算される。
   * 送らなければ危険度は出ない（今までと同じ動き）。
   */
  river?: RiverTile[];

  /**
   * 自分の副露。1つの面子を1つの文字列で書く（例: ["6s7s8s", "白白白"]）。
   * 鳴いていなければ送らない（今までと同じ動き）。
   *
   * ⚠️ hand には手の内の牌だけを入れる。副露の牌を hand に入れてはいけない。
   *    手の内 + 副露×3 が13枚になっていないと、サーバーは危険度とAI推奨を出さない。
   * ⚠️ 誰から・どの牌を鳴いたかは送らない。サーバーは engine.js v3.6 以降が必要。
   */
  fulou?: string[];
};

export async function askCoach(params: AskParams): Promise<AskResult> {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 同意した版を添える（ないとサーバーは受け付けない。src/consent/consent.ts）
    body: JSON.stringify({ ...params, consentVersion: getConsent()?.version }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "APIエラー");
  }

  return res.json();
}