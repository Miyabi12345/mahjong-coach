/**
 * 局・半荘の結果（⑦。2026-09-22。以前は文字だけの簡易版）
 *
 *   和了 … 誰が・誰から、和了した手（牌の絵。和了牌は少し離す。副露は倒して並べる）、役と翻、符・翻・点数、
 *           ドラ表示牌・裏ドラ表示牌、点数の増減
 *   流局 … 流局の名前、点数の増減
 *   終局 … 4人の順位表（順位・席・点数・順位点。自分を強調）
 */
import { StyleSheet, Text, View } from "react-native";

import type { GameEvent } from "../api/game";
import { MeldTiles } from "./MeldTiles";
import { TileFace } from "./TileFace";

const SEAT_NAMES = ["自分", "下家", "対面", "上家"];
const HONOR = ["", "東", "南", "西", "北", "白", "發", "中"];

/** 電脳麻将の手牌の文字列（例 "m2356799p234s406m1*,p555="）→ 手の内・和了牌・副露 */
function parseHand(s: string | undefined) {
  if (!s) return null;
  const [concealed, ...melds] = s.split(",");
  const tiles: string[] = [];
  let suit = "";
  for (const ch of concealed) {
    if (/[mpsz]/.test(ch)) suit = ch;
    else if (/\d/.test(ch)) tiles.push(suit === "z" ? HONOR[Number(ch)] : `${ch}${suit}`);
  }
  // 和了の手は14枚ぶん。電脳麻将は和了牌を最後に書く
  const win = tiles.pop() ?? null;
  return { tiles, win, melds: melds.filter(Boolean) };
}

/** 役の翻数。役満は「*」で来る */
const fanText = (f: number | string) => (typeof f === "string" && f.includes("*") ? (f.length > 1 ? "ダブル役満" : "役満") : `${f}翻`);

export function ResultView({ result, baopai = [] }: { result: GameEvent | null; baopai?: string[] }) {
  if (!result) return null;

  if (result.type === "hule") {
    const who = SEAT_NAMES[result.seat];
    const how = result.from == null ? "ツモ" : `${SEAT_NAMES[result.from]}からロン`;
    const hand = parseHand(result.shoupai);
    const yakuman = (result.hupai ?? []).some((h: any) => typeof h.fanshu === "string");
    return (
      <View style={styles.box}>
        <Text style={styles.title}>
          {who}の和了（{how}）
        </Text>
        {hand && (
          <View style={styles.handRow}>
            {hand.tiles.map((t, i) => (
              <View key={i} style={styles.tile}>
                <TileFace tile={t} size="small" width={22} />
              </View>
            ))}
            {hand.win && (
              <View style={[styles.tile, styles.winTile]}>
                <TileFace tile={hand.win} size="small" width={22} />
              </View>
            )}
            {hand.melds.map((m, i) => (
              <View key={i} style={{ marginLeft: 6 }}>
                <MeldTiles meld={{ raw: m, tiles: "" }} width={20} />
              </View>
            ))}
          </View>
        )}
        <View style={styles.yakuList}>
          {(result.hupai ?? []).map((h: any, i: number) => (
            <View key={i} style={styles.yakuRow}>
              <Text style={styles.yaku}>{h.name}</Text>
              <Text style={styles.fan}>{fanText(h.fanshu)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.points}>
          {yakuman ? "" : `${result.fu}符 ${result.fanshu}翻　`}
          {Number(result.defen).toLocaleString()}点
        </Text>
        <View style={styles.doraRow}>
          <Text style={styles.dim}>ドラ表示</Text>
          {baopai.map((b, i) => (
            <View key={i} style={styles.tile}>
              <TileFace tile={b} size="small" width={18} />
            </View>
          ))}
          {result.fubaopai && (
            <>
              <Text style={[styles.dim, { marginLeft: 8 }]}>裏ドラ表示</Text>
              {result.fubaopai.map((b: string, i: number) => (
                <View key={i} style={styles.tile}>
                  <TileFace tile={b} size="small" width={18} />
                </View>
              ))}
            </>
          )}
        </View>
        <Fenpei fenpei={result.fenpei} />
      </View>
    );
  }

  if (result.type === "pingju") {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>流局（{result.name}）</Text>
        <Fenpei fenpei={result.fenpei} />
      </View>
    );
  }

  if (result.type === "jieju") {
    const ids = [0, 1, 2, 3].sort((a, b) => (result.rank?.[a] ?? 9) - (result.rank?.[b] ?? 9));
    return (
      <View style={styles.box}>
        <Text style={styles.title}>終局　あなたは{result.rank?.[result.humanId]}位</Text>
        {ids.map((id) => {
          const me = id === result.humanId;
          const pt = Number(result.point?.[id]);
          return (
            <View key={id} style={[styles.rankRow, me && styles.rankMe]}>
              <Text style={[styles.rankNo, me && styles.meText]}>{result.rank?.[id]}位</Text>
              <Text style={[styles.rankName, me && styles.meText]}>{result.seatOfId?.[id] ?? `プレイヤー${id + 1}`}</Text>
              <Text style={[styles.rankScore, me && styles.meText]}>{Number(result.defen?.[id]).toLocaleString()}点</Text>
              <Text style={[styles.rankPoint, pt >= 0 ? styles.plus : styles.minus]}>
                {pt > 0 ? "+" : ""}
                {result.point?.[id]}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }
  return null;
}

/** 点数の増減（自分・下家・対面・上家）。プラスは緑、マイナスは赤 */
function Fenpei({ fenpei }: { fenpei: number[] | null }) {
  if (!fenpei) return null;
  return (
    <View style={styles.fenpeiRow}>
      {fenpei.map((v, i) => (
        <Text key={i} style={styles.fenpei}>
          {SEAT_NAMES[i]}{" "}
          <Text style={v > 0 ? styles.plus : v < 0 ? styles.minus : styles.dim}>
            {v > 0 ? "+" : ""}
            {v.toLocaleString()}
          </Text>
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#0F3D2E", borderRadius: 8, padding: 10, gap: 6, marginBottom: 8 },
  title: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  dim: { color: "#A9C8B8", fontSize: 12 },
  handRow: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap" },
  tile: { borderRadius: 3, overflow: "hidden", marginRight: 1 },
  winTile: { marginLeft: 6, borderWidth: 2, borderColor: "#E8B84B" },
  yakuList: { gap: 2 },
  yakuRow: { flexDirection: "row", justifyContent: "space-between", maxWidth: 260 },
  yaku: { color: "#DCE9E2", fontSize: 13 },
  fan: { color: "#E8B84B", fontSize: 13, fontWeight: "700" },
  points: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  doraRow: { flexDirection: "row", alignItems: "center", gap: 3, flexWrap: "wrap" },
  fenpeiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fenpei: { color: "#DCE9E2", fontSize: 13 },
  plus: { color: "#4CAF7D", fontWeight: "700" },
  minus: { color: "#E57373", fontWeight: "700" },
  rankRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 6, borderRadius: 4, gap: 8 },
  rankMe: { backgroundColor: "#1A5C46" },
  rankNo: { color: "#DCE9E2", fontSize: 14, width: 32 },
  rankName: { color: "#DCE9E2", fontSize: 14, width: 44 },
  rankScore: { color: "#DCE9E2", fontSize: 14, flex: 1 },
  rankPoint: { fontSize: 14, width: 60, textAlign: "right" },
  meText: { color: "#FFFFFF", fontWeight: "700" },
});
