/**
 * 対局の窓口（mahjong-api の game-api.js）を呼ぶ
 *
 * サーバーが対局を持っている（設計 案A。mahjong-api/docs/設計_対局の進行.md）。
 * アプリは「いまの卓」と「できること」を受け取って表示し、人間の操作を送るだけ。
 *
 * 牌の表記はアプリの表記（"1m" "東" "0m"=赤5）。
 * raw は電脳麻将の表記で、操作を送るときはこれをそのまま返す。
 */
import type { PlayerLevel, RuleConfig } from "../types/config";

import { API_BASE } from "./base";

export type RiverTile = {
  p: string;
  tsumogiri: boolean;
  riichi: boolean;
  /** 鳴かれた牌 */
  called: boolean;
};

export type Meld = { tiles: string; raw: string };

export type Seat = {
  /** 0=自分 1=下家 2=対面 3=上家 */
  seat: number;
  name: string;
  /** 0=東（親） */
  menfeng: number;
  score: number;
  riichi: boolean;
  river: RiverTile[];
  fulou: Meld[];
};

export type GameView = {
  round: {
    zhuangfeng: number;
    jushu: number;
    changbang: number;
    lizhibang: number;
    /** ドラ表示牌 */
    baopai: string[];
    /** ドラそのもの（表示牌の次の牌）。カンで増えたら全部 */
    dora: string[];
    paishu: number | null;
  };
  seats: Seat[];
  me: { hand: string[]; draw: string | null; menfeng: number };
};

export type TileChoice = { p: string; raw: string };

export type Choices =
  | {
      type: "zimo";
      dapai: TileChoice[];
      lizhi: TileChoice[];
      hule: boolean;
      gang: Meld[];
      pingju: boolean;
    }
  | {
      type: "call";
      tile?: string;
      hule: boolean;
      chi: Meld[];
      peng: Meld[];
      gang: Meld[];
      daopai: boolean;
    }
  /** リーチ後のツモ切り。アプリが少し待って next を送る（skip でこの局は結果まで飛ばす） */
  | { type: "riichi_auto"; dapai: TileChoice[] }
  | { type: "daopai"; daopai: boolean }
  | { type: "kyoku_end" }
  | { type: "game_end" };

export type GameEvent = { type: string; [key: string]: any };

export type GameResponse = {
  gameId: string;
  ended: boolean;
  view: GameView;
  events: GameEvent[];
  choices: Choices | null;
  result: GameEvent | null;
};

export type Action =
  | { action: "dapai" | "lizhi"; raw: string }
  | { action: "hule" | "pass" | "pingju" | "daopai" | "next" | "skip" }
  | { action: "gang" | "fulou"; raw: string };

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `サーバーのエラー（${res.status}）`);
  return json as T;
}

export function startGame(rule: RuleConfig, level: PlayerLevel, objective: string) {
  return call<GameResponse>("/game/start", { rule, level, objective });
}

export function sendAction(gameId: string, action: Action) {
  return call<GameResponse>(`/game/${gameId}/action`, action);
}

export type AskAnswer = {
  questionId: string;
  answer: string;
  recommended: string | null;
  riichi: boolean;
  rating: "○" | "×" | null;
  /** 鳴きの相談のときだけ付く（出た牌とAIの判断） */
  fulou?: { tile: string | null; ai: string };
};

/**
 * 質問。target: 'now'=いまの局面 / 'last'=直前の打牌の振り返り
 *
 * 'now' は、自分のツモ番なら「何を切るか」、鳴ける場面なら「鳴くかどうか」の相談になる
 * （どちらかはサーバーが局面を見て決める。mahjong-api の game-api.js）
 */
export function askInGame(
  gameId: string,
  question: string,
  target: "now" | "last",
  discard?: string
) {
  return call<AskAnswer>(`/game/${gameId}/ask`, { question, target, discard });
}

export function sendFeedback(gameId: string, questionId: string, good: boolean, comment?: string) {
  return call<{ ok: boolean }>(`/game/${gameId}/feedback`, { questionId, good, comment });
}
