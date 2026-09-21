/**
 * 卓（盤面）。天鳳のように、中央に局の情報、そのまわりに4人の河を置く（2026-09-22。みやびさんの要望）
 *
 *   ・2次元。山は出さない（残り枚数とドラ表示牌を中央に出す）
 *   ・河は、その人の向きで置く（自分=下・下家=右・対面=上・上家=左）。6枚・6枚で折り返し、3列目は折り返さずに伸ばす（天鳳と同じ）
 *   ・リーチ宣言牌は横に倒す
 *   ・他家の鳴いた牌は、その人の右手側の角に置く（実際の卓で副露を置く位置）。
 *     自分の鳴いた牌は、今までどおり手牌の横
 *   ・牌の大きさは、盤面の幅から決める（iPhone の縦画面でも収まるように）
 *
 * ⚠️ 鳴いた牌を横に倒して誰から鳴いたかを見せる（#34）は、まだ。副露は立てたまま並べる
 */
import { StyleSheet, Text, View } from "react-native";

import type { GameView, Meld, RiverTile } from "../api/game";
import { TileFace } from "./TileFace";

const WIND = ["東", "南", "西", "北"];
const ROW = 6;          // 河の1列の枚数
const DEPTH_ROWS = 3;   // 河の奥行き（何列ぶん場所を取るか）。3列目は横に伸びる

/** 赤5（0m）も5mとしてドラか調べる */
const plain = (t: string) => (t.length === 2 && t[0] === "0" ? `5${t[1]}` : t);

/** "6s7s8s" → ["6s","7s","8s"] */
function splitMeld(meld: string): string[] {
  return meld.match(/[0-9][mps]|[東南西北白發中]/g) ?? [];
}

export function Board({ view, size }: { view: GameView; size: number }) {
  // 牌の幅 w：中央の四角 = 6枚ぶん、左右の河 = 4列ぶん（高さ 4/3 w）
  const w = Math.floor(size / (ROW + 2 * DEPTH_ROWS * (4 / 3) + 0.4));
  const h = Math.round((w * 4) / 3);
  const C = w * ROW;                 // 中央の四角の一辺
  const D = h * DEPTH_ROWS;          // 河の奥行き
  const S = C + 2 * D;               // 盤面の一辺
  const r = view.round;
  const dora = r.dora ?? [];

  // 河の置き場所：自分の向きで作った「幅C × 高さD」の箱を、回して置く
  const riverBox = (rel: number) => {
    const deg = [0, -90, 180, 90][rel];
    const cx = [S / 2, S - D / 2, S / 2, D / 2][rel];
    const cy = [S - D / 2, S / 2, D / 2, S / 2][rel];
    return {
      position: "absolute" as const,
      left: cx - C / 2,
      top: cy - D / 2,
      width: C,
      height: D,
      transform: [{ rotate: `${deg}deg` }],
    };
  };

  // 他家の副露：その人の右手側の角（下家=右上・対面=左上・上家=左下）
  const cornerBox = (rel: number) => {
    const pos = [null, { right: 0, top: 0 }, { left: 0, top: 0 }, { left: 0, bottom: 0 }][rel];
    return { position: "absolute" as const, width: D, height: D, ...pos };
  };

  return (
    <View style={{ width: S, height: S, alignSelf: "center" }}>
      {/* 中央：局の情報と、4人の点数（それぞれの人の向き） */}
      <View style={[styles.center, { left: D, top: D, width: C, height: C }]}>
        <Text style={[styles.round, { fontSize: Math.max(12, w * 0.7) }]}>
          {WIND[r.zhuangfeng]}{r.jushu + 1}局
        </Text>
        <Text style={styles.small}>
          {r.changbang}本場{r.lizhibang ? `・供託${r.lizhibang}` : ""}　残り{r.paishu ?? "-"}
        </Text>
        <View style={styles.doraRow}>
          {r.baopai.map((b, i) => (
            <View key={i} style={styles.doraIndicator}>
              <TileFace tile={b} size="small" width={Math.round(w * 0.8)} />
            </View>
          ))}
        </View>
        <Text style={styles.small}>ドラ {dora.map(plain).join(" ")}</Text>

        {[0, 1, 2, 3].map((rel) => {
          const s = view.seats[rel];
          if (!s) return null;
          const deg = [0, -90, 180, 90][rel];
          // 中央の四角の辺に沿って置く（回す前は下の辺）
          const cx = [C / 2, C - 9, C / 2, 9][rel];
          const cy = [C - 9, C / 2, 9, C / 2][rel];
          const bw = C * 0.9;
          return (
            <View
              key={rel}
              style={{
                position: "absolute",
                left: cx - bw / 2,
                top: cy - 9,
                width: bw,
                height: 18,
                transform: [{ rotate: `${deg}deg` }],
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={[styles.wind, s.menfeng === 0 && styles.oya]}>{WIND[s.menfeng]}</Text>
              <Text style={styles.score}>{s.score.toLocaleString()}</Text>
              {s.riichi && <View style={styles.riichiStick} />}
            </View>
          );
        })}
      </View>

      {/* 4人の河 */}
      {[0, 1, 2, 3].map((rel) => {
        const s = view.seats[rel];
        if (!s) return null;
        return (
          <View key={`river-${rel}`} style={riverBox(rel)}>
            {/* 6枚・6枚・残り全部（3列目ははみ出してよい） */}
            {[s.river.slice(0, ROW), s.river.slice(ROW, ROW * 2), s.river.slice(ROW * 2)].map((row, j) => (
              <View key={j} style={styles.riverRow}>
                {row.map((t, i) => (
                  <RiverTileSmall key={i} t={t} w={w} h={h} dora={dora} />
                ))}
              </View>
            ))}
          </View>
        );
      })}

      {/* 他家の副露 */}
      {[1, 2, 3].map((rel) => {
        const s = view.seats[rel];
        if (!s?.fulou.length) return null;
        return (
          <View key={`meld-${rel}`} style={[cornerBox(rel), styles.corner]}>
            <Text style={styles.cornerName}>{s.name}</Text>
            {s.fulou.map((m, i) => (
              <MeldSmall key={i} meld={m} w={Math.round(w * 0.75)} dora={dora} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

/** 河の牌1枚。リーチ宣言牌は横に倒す */
function RiverTileSmall({ t, w, h, dora }: { t: RiverTile; w: number; h: number; dora: string[] }) {
  const isDora = dora.includes(plain(t.p));
  const face = (
    <View
      style={[
        styles.tileWrap,
        isDora && styles.dora,
        t.tsumogiri && styles.tsumogiri,
        t.called && styles.called,
      ]}
    >
      <TileFace tile={t.p} size="river" width={w} />
    </View>
  );
  if (!t.riichi) return face;
  // 横に倒す：場所は「高さ h × 幅 h」を取り、中で90度回す
  return (
    <View style={{ width: h, height: h, alignItems: "center", justifyContent: "center" }}>
      <View style={{ transform: [{ rotate: "90deg" }] }}>{face}</View>
    </View>
  );
}

function MeldSmall({ meld, w, dora }: { meld: Meld; w: number; dora: string[] }) {
  return (
    <View style={styles.meld}>
      {splitMeld(meld.tiles).map((t, i) => (
        <View key={i} style={[styles.tileWrap, dora.includes(plain(t)) && styles.dora]}>
          <TileFace tile={t} size="small" width={w} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    backgroundColor: "#0B2B20",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2E5E4B",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  round: { color: "#FFFFFF", fontWeight: "700" },
  small: { color: "#A8C5B5", fontSize: 10 },
  doraRow: { flexDirection: "row", gap: 2 },
  doraIndicator: { borderRadius: 3, overflow: "hidden" },
  wind: { color: "#A8C5B5", fontSize: 11, fontWeight: "700" },
  oya: { color: "#E8B84B" },
  score: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  riichiStick: { width: 16, height: 4, borderRadius: 2, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E85D5D" },
  riverRow: { flexDirection: "row", alignItems: "flex-end" },
  tileWrap: { borderRadius: 3, overflow: "hidden" },
  dora: { borderWidth: 1.5, borderColor: "#E8B84B" },
  tsumogiri: { opacity: 0.6 },
  called: { opacity: 0.35 },
  corner: { padding: 2, gap: 2, alignItems: "flex-start" },
  cornerName: { color: "#7FA893", fontSize: 9 },
  meld: { flexDirection: "row", gap: 0 },
});
