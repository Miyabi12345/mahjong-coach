/**
 * データの取り扱いへの同意（Phase 2。2026-09-22）
 *
 * ★なぜ要るか（mahjong-api docs/リリース準備_開発以外にやること.md 2-4・2-5・2-7）
 *   - 質問文・局面・音声を OpenAI（アメリカ）に送る → 個人情報保護法28条「外国にある第三者への提供」として扱う（安全側）。
 *     同意の前に ①国の名前 ②その国の制度 ③OpenAI の保護措置 を知らせる（28条2項）
 *   - App Store ガイドライン 5.1.2(i)：第三者（third-party AI を含む）に送るなら、事前に明示的な許可
 *   - 外国への提供の同意は、ほかの同意と区別して見せる
 *   - OpenAI の規約：18歳未満は保護者の許可が必要（取得はこちら側の責任）
 *
 * ⚠️ この文面は下書き。プライバシーポリシーと一緒に、みやびさん（と弁護士）が確認する。
 *    文面を変えたら CONSENT_VERSION を変える（同意し直してもらうため。サーバーは版の名前を記録する）
 *
 * ★保存：ブラウザ版は localStorage。アプリ版（EAS ビルド）は AsyncStorage に置き換える（Phase 3。いまは覚えていられない）
 */
import { Platform } from "react-native";

export const CONSENT_VERSION = "2026-09-22-draft1";

export type Consent = { version: string; at: string };

const KEY = "mahjongCoach.consent";
let memory: Consent | null = null;   // localStorage が使えないときの控え（アプリを閉じると消える）

export function getConsent(): Consent | null {
  try {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(KEY);
      const c = raw ? (JSON.parse(raw) as Consent) : null;
      return c?.version === CONSENT_VERSION ? c : null;   // 版が変わったら同意し直し
    }
  } catch {
    /* 読めなければ控えを見る */
  }
  return memory?.version === CONSENT_VERSION ? memory : null;
}

export function saveConsent() {
  const c: Consent = { version: CONSENT_VERSION, at: new Date().toISOString() };
  memory = c;
  try {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* 保存できなくても、この起動中は控えで動く */
  }
  return c;
}

export function clearConsent() {
  memory = null;
  try {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } catch {
    /* 何もしない */
  }
}

/** 同意画面に出す文（下書き） */
export const CONSENT_TEXT = {
  title: "コーチを使う前に",
  lead: "コーチの回答は、外部のAIサービス（OpenAI）で作っています。コーチに質問すると、次の情報を送ります。",
  sent: [
    "質問の文（音声入力のときは、文字にした文）",
    "質問したときの局面（手牌・河・点数など。対局の中身だけで、名前やメールアドレスは送りません）",
    "音声入力の録音（文字にするためだけに送ります。録音はこのアプリでも保存しません）",
  ],
  purpose: [
    "OpenAI に送る目的：コーチの回答を作るため・声を文字にするため",
    "このアプリのサーバーに残すもの：対局の記録・質問・回答・👍👎・報告（コーチの精度を良くするため）",
  ],
  // 外国への提供（ほかの同意と分けて見せる）
  foreign: {
    heading: "外国（アメリカ合衆国）への提供について",
    country: "送り先：OpenAI（アメリカ合衆国）",
    system:
      "アメリカ合衆国の個人情報の保護の制度については、個人情報保護委員会の調査をご覧ください。",
    systemLink: "https://www.ppc.go.jp/enforcement/infoprovision/laws/offshore_report_america/",
    measures: [
      "送った情報は、OpenAI のAIの学習には使われません（OpenAI の説明による）",
      "送った情報は、不正利用を見つけるために最大30日保存され、その後削除されます（同）",
      "音声を文字にする機能では、録音は保存されません（同）",
    ],
    measuresLink: "https://openai.com/enterprise-privacy/",
  },
  age: "18歳以上です。または、18歳未満で保護者の同意を得ています",
  note: "同意しなくても、コーチを使わずに対局はできます。同意はホーム画面の「データの取り扱い」から、いつでも取り消せます。",
};
