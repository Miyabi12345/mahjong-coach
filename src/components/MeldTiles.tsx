/**
 * 副露（鳴いた面子）の並べ方（#34。2026-09-22。みやびさんの要望「誰から鳴いたか分かるように、鳴いた牌は倒す」）
 *
 * サーバーは電脳麻将の表記（Meld.raw）を送ってくる。印の直前の数字が、鳴いた牌：
 *   m1-23  … 上家（-）から 1m をチー     p555=  … 対面（=）から 5p をポン
 *   z444+  … 下家（+）から 北 をポン     s5550- … 上家から 赤5s で大明槓
 *   p555=5 … 加槓（印の後ろの数字が、あとから足した牌）    m5555 … 暗槓（印なし）
 *
 * 並べ方（実際の卓と同じ。鳴いた人から見て）：
 *   上家から → 左端を横に倒す ／ 対面から → 左から2枚目 ／ 下家から → 右端
 *   加槓 → 倒した牌の上に、足した牌も倒して重ねる ／ 暗槓 → 両端を裏向き
 */
import { View } from "react-native";

import type { Meld } from "../api/game";
import { TileFace } from "./TileFace";

const HONOR = ["", "東", "南", "西", "北", "白", "發", "中"];

type Piece = { tile: string; called: boolean; added?: string; back?: boolean };

/** 電脳麻将の1牌（色＋数字）→ アプリの表記（1m・0p・東 など） */
function toApp(suit: string, d: string) {
  return suit === "z" ? HONOR[Number(d)] : `${d}${suit}`;
}

/** raw を並べる順の牌にする。読めなければ null（そのときは tiles をそのまま並べる） */
export function parseMeld(raw: string): Piece[] | null {
  if (!raw || !/^[mpsz]/.test(raw)) return null;
  const suit = raw[0];
  const body = raw.slice(1);
  const markAt = body.search(/[+=-]/);
  if (markAt < 0) {
    // 暗槓（印なし）：両端を裏向き
    const ds = body.split("");
    if (ds.length === 4) return ds.map((d, i) => ({ tile: toApp(suit, d), called: false, back: i === 0 || i === 3 }));
    return ds.map((d) => ({ tile: toApp(suit, d), called: false }));
  }
  const mark = body[markAt];
  const before = body.slice(0, markAt).split("");   // 最後の1つが鳴いた牌
  const after = body.slice(markAt + 1).split("");   // チーの残り（m1-23 の 23）か、加槓で足した牌（p555=5 の 5）
  if (!before.length) return null;
  const calledD = before.pop()!;
  // 加槓：全部で4枚、印の後ろが1枚だけ（ポンの形の後ろに足した牌）
  const isKakan = before.length + 1 + after.length === 4 && after.length === 1;
  const called: Piece = { tile: toApp(suit, calledD), called: true, added: isKakan ? toApp(suit, after[0]) : undefined };
  const rest: Piece[] = [...before, ...(isKakan ? [] : after)].map((d) => ({ tile: toApp(suit, d), called: false }));
  // 鳴いた人から見た位置：上家=左端 / 対面=左から2枚目 / 下家=右端
  if (mark === "-") return [called, ...rest];
  if (mark === "=") return [rest[0], called, ...rest.slice(1)].filter(Boolean) as Piece[];
  return [...rest, called];
}

/** 赤5（0m）も5mとしてドラか調べる */
const plain = (t: string) => (t.length === 2 && t[0] === "0" ? `5${t[1]}` : t);

export function MeldTiles({ meld, width, dora = [], doraStyle }: { meld: Meld; width: number; dora?: string[]; doraStyle?: object }) {
  const h = Math.round((width * 4) / 3);
  const pieces: Piece[] =
    parseMeld(meld.raw) ?? (meld.tiles.match(/[0-9][mps]|[東南西北白發中]/g) ?? []).map((t) => ({ tile: t, called: false }));
  const face = (t: string, back?: boolean) => (
    <View style={[{ borderRadius: 3, overflow: "hidden" }, !back && dora.includes(plain(t)) ? doraStyle : null]}>
      <TileFace tile={t} size="small" width={width} back={back} />
    </View>
  );
  // 横に倒した牌：場所は「幅 h × 高さ width」
  const lying = (t: string) => (
    <View style={{ width: h, height: width, alignItems: "center", justifyContent: "center" }}>
      <View style={{ transform: [{ rotate: "-90deg" }] }}>{face(t)}</View>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
      {pieces.map((p, i) =>
        p.called ? (
          <View key={i} style={{ marginHorizontal: 1 }}>
            {p.added && lying(p.added)}
            {lying(p.tile)}
          </View>
        ) : (
          <View key={i} style={{ marginHorizontal: 0.5 }}>{face(p.tile, p.back)}</View>
        ),
      )}
    </View>
  );
}
