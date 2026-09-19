import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { askCoach, type DangerInfo, type RiverTile } from "../api/coach";
import { getMatchConfig } from "../store/matchStore";
import { getPresets, OBJECTIVES } from "../types/config";

// ============================================================
// 局面プリセット
//
// extract-scenes.js が自動対局から抜き出した実際の局面。
// 手牌と河が必ず整合しているので、麻雀としてありえない形にならない。
//
// river の l は「その局の親を0とした位置」。座席ではない。
// 自分の位置は menfeng に入っている。
// ============================================================

type Opponent = {
  name: string;
  riichi?: boolean;
  riichiJunme?: number;
  fulou?: string[];
};

type Scene = {
  label: string;
  junme: number;
  isOya: boolean;
  zhuangfeng: number;
  jushu: number;
  menfeng: number;
  honba: number;
  kyotaku: number;
  defen: number[];
  baopai: string;
  remaining: number;
  hand: string[];
  draw: string;
  /** 自分の副露（例: ["6s7s8s"]）。鳴いていなければ書かない */
  fulou?: string[];
  opponents: Opponent[];
  river: RiverTile[];
};

const SCENES: Scene[] = [
  {
    label: "東1局 序盤 親",
    junme: 5,
    isOya: true,
    zhuangfeng: 0,
    jushu: 0,
    menfeng: 0,
    honba: 0,
    kyotaku: 0,
    defen: [25000, 25000, 25000, 25000],
    baopai: "9p",
    remaining: 53,
    hand: ["1m", "2m", "3m", "3m", "3m", "4m", "7m", "8m", "9m", "5p", "2s", "9s", "發"],
    draw: "4p",
    opponents: [],
    river: [
      { l: 0, p: "南" },
      { l: 1, p: "9p" },
      { l: 2, p: "中" },
      { l: 3, p: "北" },
      { l: 0, p: "白" },
      { l: 1, p: "白" },
      { l: 2, p: "東" },
      { l: 3, p: "中", tsumogiri: true },
      { l: 0, p: "1p" },
      { l: 1, p: "西", tsumogiri: true },
      { l: 2, p: "1s" },
      { l: 3, p: "西", tsumogiri: true },
      { l: 0, p: "東" },
      { l: 1, p: "北", tsumogiri: true },
      { l: 2, p: "8p" },
      { l: 3, p: "東" },
    ],
  },
  {
    label: "東1局 終盤 親リーチ受け",
    junme: 11,
    isOya: true,
    zhuangfeng: 0,
    jushu: 0,
    menfeng: 0,
    honba: 0,
    kyotaku: 0,
    defen: [25000, 25000, 25000, 25000],
    baopai: "9p",
    remaining: 30,
    hand: ["1m", "2m", "3m", "3m", "3m", "4m", "5m", "7m", "8m", "9m", "4p", "5p", "2s"],
    draw: "9s",
    opponents: [
      { name: "対面", fulou: ["8s8s8s"] },
      { name: "上家", riichi: true, riichiJunme: 10 },
    ],
    river: [
      { l: 0, p: "南" },
      { l: 1, p: "9p" },
      { l: 2, p: "中" },
      { l: 3, p: "北" },
      { l: 0, p: "白" },
      { l: 1, p: "白" },
      { l: 2, p: "東" },
      { l: 3, p: "中", tsumogiri: true },
      { l: 0, p: "1p" },
      { l: 1, p: "西", tsumogiri: true },
      { l: 2, p: "1s" },
      { l: 3, p: "西", tsumogiri: true },
      { l: 0, p: "東" },
      { l: 1, p: "北", tsumogiri: true },
      { l: 2, p: "8p" },
      { l: 3, p: "東" },
      { l: 0, p: "發" },
      { l: 1, p: "發" },
      { l: 2, p: "2p" },
      { l: 3, p: "1p" },
      { l: 0, p: "9s" },
      { l: 1, p: "8m" },
      { l: 2, p: "4m" },
      { l: 3, p: "8m" },
      { l: 0, p: "發", tsumogiri: true },
      { l: 1, p: "2s" },
      { l: 2, p: "1p", tsumogiri: true },
      { l: 3, p: "白", tsumogiri: true },
      { l: 0, p: "9m" },
      { l: 1, p: "7p", tsumogiri: true },
      { l: 2, p: "7m" },
      { l: 3, p: "西", tsumogiri: true },
      { l: 0, p: "南", tsumogiri: true },
      { l: 1, p: "8s", tsumogiri: true },
      { l: 2, p: "3s" },
      { l: 3, p: "2s" },
      { l: 0, p: "北", tsumogiri: true },
      { l: 1, p: "4s" },
      { l: 2, p: "7s" },
      { l: 3, p: "3p", riichi: true },
    ],
  },
  {
    label: "オーラス ラス目",
    junme: 10,
    isOya: false,
    zhuangfeng: 1,
    jushu: 3,
    menfeng: 2,
    honba: 1,
    kyotaku: 1,
    defen: [12300, 27500, 25700, 33500],
    baopai: "3s",
    remaining: 31,
    hand: ["3m", "0m", "1p", "1p", "2p", "4p", "4p", "5p", "7p", "4s", "5s", "6s", "9s"],
    draw: "3p",
    opponents: [
      { name: "下家", riichi: true, riichiJunme: 7 },
      { name: "上家", riichi: true, riichiJunme: 4 },
    ],
    river: [
      { l: 0, p: "北" },
      { l: 1, p: "3s" },
      { l: 2, p: "北" },
      { l: 3, p: "西" },
      { l: 0, p: "東" },
      { l: 1, p: "7s", tsumogiri: true },
      { l: 2, p: "東" },
      { l: 3, p: "東" },
      { l: 0, p: "9m" },
      { l: 1, p: "1s", tsumogiri: true },
      { l: 2, p: "發" },
      { l: 3, p: "9m", tsumogiri: true },
      { l: 0, p: "白", tsumogiri: true },
      { l: 1, p: "6m", riichi: true },
      { l: 2, p: "白" },
      { l: 3, p: "1m" },
      { l: 0, p: "7s" },
      { l: 1, p: "東", tsumogiri: true },
      { l: 2, p: "中" },
      { l: 3, p: "3s" },
      { l: 0, p: "3s" },
      { l: 1, p: "9p", tsumogiri: true },
      { l: 2, p: "2s" },
      { l: 3, p: "中", tsumogiri: true },
      { l: 0, p: "白", tsumogiri: true },
      { l: 1, p: "6p", tsumogiri: true },
      { l: 2, p: "1s", tsumogiri: true },
      { l: 3, p: "3m", riichi: true },
      { l: 0, p: "1m" },
      { l: 1, p: "8p", tsumogiri: true },
      { l: 2, p: "8p" },
      { l: 3, p: "2s", tsumogiri: true },
      { l: 0, p: "發", tsumogiri: true },
      { l: 1, p: "8m", tsumogiri: true },
      { l: 2, p: "2s" },
      { l: 3, p: "1s", tsumogiri: true },
      { l: 0, p: "西", tsumogiri: true },
      { l: 1, p: "1s", tsumogiri: true },
    ],
  },
  {
    label: "オーラス トップ目",
    junme: 6,
    isOya: false,
    zhuangfeng: 1,
    jushu: 3,
    menfeng: 3,
    honba: 0,
    kyotaku: 0,
    defen: [33800, 30100, 7900, 28200],
    baopai: "北",
    remaining: 46,
    hand: ["5m", "5m", "6m", "4p", "4p", "9p", "9p", "9p", "1s", "3s", "4s", "6s", "8s"],
    draw: "2p",
    opponents: [],
    river: [
      { l: 0, p: "北" },
      { l: 1, p: "7s" },
      { l: 2, p: "發" },
      { l: 3, p: "北" },
      { l: 0, p: "中", tsumogiri: true },
      { l: 1, p: "4s" },
      { l: 2, p: "4s" },
      { l: 3, p: "9m" },
      { l: 0, p: "1p", tsumogiri: true },
      { l: 1, p: "5s", tsumogiri: true },
      { l: 2, p: "東" },
      { l: 3, p: "2m" },
      { l: 0, p: "中", tsumogiri: true },
      { l: 1, p: "北" },
      { l: 2, p: "1s" },
      { l: 3, p: "中", tsumogiri: true },
      { l: 0, p: "8p" },
      { l: 1, p: "中" },
      { l: 2, p: "9p" },
      { l: 3, p: "1p", tsumogiri: true },
      { l: 0, p: "4p" },
      { l: 1, p: "東" },
      { l: 2, p: "4p" },
    ],
  },
  {
    // 自分が鳴いている局面。fulou-find.js が自動対局から拾ったもの
    // （mahjong-api の data/fulou-find.json 「染め手」の1件目）。
    //
    // 自分は上家が切った 7s を 6s8s でチーしている（上家の河の 7s がそれ）。
    // 対面は筒子を2つ鳴いている（下家の 8p と 6p）。
    //
    // ⚠️ 元の記録には点数・残り枚数がない。
    //    点数は全員25,000点で補った（compare-models.js 局面3と同じ）。
    //    残り枚数は数え直した: 配牌後70枚 − ツモ14回 = 56枚
    //      （河16枚のうち、鳴いた直後の打牌3枚はツモなし → 13回 ＋ いまのツモ1回）
    //    compare-models.js 局面3は70枚としているが、それは配牌直後の枚数で誤り。
    label: "東3局 序盤 親 鳴き",
    junme: 4,
    isOya: true,
    zhuangfeng: 0,
    jushu: 2,
    menfeng: 0,
    honba: 0,
    kyotaku: 0,
    defen: [25000, 25000, 25000, 25000],
    baopai: "1m",
    remaining: 56,
    hand: ["2m", "2m", "6m", "6m", "3p", "6p", "7p", "8p", "4s", "東"],
    draw: "1s",
    fulou: ["6s7s8s"],
    opponents: [{ name: "対面", fulou: ["6p7p8p", "4p5p6p"] }],
    river: [
      { l: 0, p: "北" },
      { l: 1, p: "南" },
      { l: 2, p: "南" },
      { l: 3, p: "南" },
      { l: 0, p: "發" },
      { l: 1, p: "8m" },
      { l: 2, p: "發" },
      { l: 3, p: "中" },
      { l: 0, p: "1s" },
      { l: 1, p: "8p" },
      { l: 2, p: "9s" },
      { l: 3, p: "7s" },
      { l: 0, p: "9m" },
      { l: 1, p: "6p" },
      { l: 2, p: "2s" },
      { l: 3, p: "4s" },
    ],
  },
];

// ============================================================
// 表示用の小物
// ============================================================

const SEAT_NAMES = ["自分", "下家", "対面", "上家"];

/** 赤5（0m など）かどうか */
function isAka(tile: string) {
  return tile.length === 2 && tile[0] === "0";
}

/** 画面に出す文字。赤5は「5m」と書き、色で区別する */
function tileText(tile: string) {
  return isAka(tile) ? `5${tile[1]}` : tile;
}

/**
 * 副露の文字列を1枚ずつに分ける
 *   "6s7s8s" → ["6s", "7s", "8s"]
 *   "白白白" → ["白", "白", "白"]
 * 数牌は「数字＋色」の2文字、字牌は1文字。
 */
function splitMeld(meld: string): string[] {
  const tiles: string[] = [];
  let i = 0;
  while (i < meld.length) {
    if (/[0-9]/.test(meld[i]) && i + 1 < meld.length) {
      tiles.push(meld.slice(i, i + 2));
      i += 2;
    } else {
      tiles.push(meld[i]);
      i += 1;
    }
  }
  return tiles;
}

export default function GameScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<string | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  const [danger, setDanger] = useState<DangerInfo | null>(null);
  const [sceneIdx, setSceneIdx] = useState(0);

  const { rule, objective, level, showRating } = getMatchConfig();
  const scene = SCENES[sceneIdx];
  const objectiveLabel = OBJECTIVES.find((o) => o.id === objective)?.label ?? "標準";
  const umaLabel = getPresets(rule.playerCount).find((p) => p.id === rule.umaOka)?.label ?? "";

  /**
   * 河を「自分・下家・対面・上家」ごとに分ける
   *
   * river の l は親からの位置。自分は scene.menfeng。
   * 相対位置 = (l - menfeng + 4) % 4  → 0が自分、1が下家…
   */
  const riverBySeat = useMemo(() => {
    const rows: RiverTile[][] = [[], [], [], []];
    for (const t of scene.river) {
      const rel = (t.l - scene.menfeng + 4) % 4;
      rows[rel].push(t);
    }
    return rows;
  }, [scene]);

  /** 局面を切り替えたら、選択と回答をリセットする */
  const changeScene = (i: number) => {
    setSceneIdx(i);
    setSelected(null);
    setAnswer(null);
    setRecommended(null);
    setRating(null);
    setDanger(null);
  };

  const opponentOf = (name: string) => scene.opponents.find((o) => o.name === name);

  const handleAsk = async () => {
    if (!selected) {
      setAnswer("先に切る牌を選んでください。");
      return;
    }

    setLoading(true);
    setAnswer(null);

    try {
      const { label, ...sceneData } = scene;   // label は表示用なので送らない

      const result = await askCoach({
        discard: selected,
        question: question.trim() || "なんで？",
        objective: objectiveLabel,
        rule,
        level,
        ...sceneData,   // hand / draw / river / 局面すべて
      });

      setAnswer(result.answer);
      setRecommended(result.recommended + (result.riichi ? "（リーチ）" : ""));
      setRating(result.rating);
      setDanger(result.danger ?? null);
      setQuestion("");
    } catch (e: any) {
      setAnswer(`接続できませんでした。\n${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.table}>
        <View style={styles.tableInfo}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Text style={styles.tableInfoText}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={styles.tableInfoText}>{scene.junme}巡目</Text>
          <Text style={styles.tableInfoText}>残り {scene.remaining}枚</Text>
        </View>

        {/* 局面切り替え */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sceneRow}
        >
          {SCENES.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.sceneChip, sceneIdx === i && styles.sceneChipOn]}
              onPress={() => changeScene(i)}
            >
              <Text style={[styles.sceneText, sceneIdx === i && styles.sceneTextOn]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.tagRow}>
          <Text style={styles.tag}>{umaLabel}</Text>
          <Text style={styles.tag}>ドラ表示 {scene.baopai}</Text>
          {scene.honba > 0 && <Text style={styles.tag}>{scene.honba}本場</Text>}
          {scene.kyotaku > 0 && <Text style={styles.tag}>供託{scene.kyotaku}</Text>}
          <Text style={styles.tagObjective}>{objectiveLabel}</Text>
        </View>

        {/* 他家の状態と点数 */}
        <View style={styles.seatRow}>
          {[1, 2, 3].map((i) => {
            const o = opponentOf(SEAT_NAMES[i]);
            return (
              <View key={i} style={styles.seat}>
                <Text style={styles.seatName}>{SEAT_NAMES[i]}</Text>
                <Text style={styles.seatScore}>{scene.defen[i].toLocaleString()}</Text>
                <View style={styles.badgeRow}>
                  {o?.riichi && (
                    <Text style={styles.riichi}>リーチ{o.riichiJunme ?? ""}</Text>
                  )}
                  {o?.fulou?.length ? <Text style={styles.fulou}>副露</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* 河 */}
        <ScrollView style={styles.riverArea}>
          {[0, 1, 2, 3].map((rel) => (
            <View key={rel} style={styles.riverRow}>
              <Text style={styles.riverLabel}>{SEAT_NAMES[rel]}</Text>
              <View style={styles.riverTiles}>
                {riverBySeat[rel].map((t, j) => (
                  <View
                    key={j}
                    style={[
                      styles.riverTile,
                      t.riichi && styles.riverTileRiichi,
                      t.tsumogiri && styles.riverTileTsumogiri,
                    ]}
                  >
                    <Text
                      style={[
                        styles.riverTileText,
                        isAka(t.p) && styles.akaText,
                      ]}
                    >
                      {tileText(t.p)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.myScore}>
          <Text style={styles.seatName}>自分{scene.isOya ? "（親）" : "（子）"}</Text>
          <Text style={styles.seatScore}>{scene.defen[0].toLocaleString()}</Text>
        </View>
      </View>

      {/* 手牌 */}
      <View style={styles.handArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {scene.hand.map((tile, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.tile, selected === tile && styles.tileSelected]}
              onPress={() => setSelected(tile)}
            >
              <Text style={[styles.tileText, isAka(tile) && styles.akaText]}>
                {tileText(tile)}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.drawGap} />
          <TouchableOpacity
            style={[
              styles.tile,
              styles.tileDraw,
              selected === scene.draw && styles.tileSelected,
            ]}
            onPress={() => setSelected(scene.draw)}
          >
            <Text style={[styles.tileText, isAka(scene.draw) && styles.akaText]}>
              {tileText(scene.draw)}
            </Text>
          </TouchableOpacity>

          {/* 自分の副露。切れないのでタップできない */}
          {scene.fulou?.map((meld, i) => (
            <View key={`fulou-${i}`} style={styles.meld}>
              {splitMeld(meld).map((tile, j) => (
                <View key={j} style={styles.meldTile}>
                  <Text style={[styles.meldTileText, isAka(tile) && styles.akaText]}>
                    {tileText(tile)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* コーチ */}
      <View style={styles.coach}>
        <View style={styles.coachHeader}>
          <Text style={styles.coachTitle}>AI Coach</Text>
          {/* 手の進みの ○×。設定で表示しないこともできる */}
          {showRating !== false && rating && (
            <View
              style={[
                styles.badge,
                rating === "○" && styles.badgeGood,
                rating === "×" && styles.badgeBad,
              ]}
            >
              <Text style={styles.badgeText}>{rating}</Text>
            </View>
          )}
          {recommended && <Text style={styles.coachMode}>推奨: {recommended}</Text>}
        </View>

        {/* 安全な牌の順（リーチがある場合のみ出る） */}
        {danger?.available && danger.safest?.length ? (
          <Text style={styles.safeLine}>
            安全な順:{" "}
            {danger.safest
              .map((s) => `${tileText(s.discard)}${s.rate != null ? `(${s.rate}%)` : ""}`)
              .join(" → ")}
          </Text>
        ) : null}

        <ScrollView style={styles.coachBody}>
          {loading ? (
            <ActivityIndicator color="#E8B84B" style={{ marginTop: 12 }} />
          ) : (
            <Text style={styles.coachText}>
              {answer ?? "局面を選び、牌をタップして質問してみてください。"}
            </Text>
          )}
        </ScrollView>
      </View>

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="なんで？ / この局面で気をつけることは？"
          placeholderTextColor="#5A7A6B"
          onSubmitEditing={handleAsk}
        />
        <TouchableOpacity
          style={[styles.askButton, loading && styles.askButtonDisabled]}
          onPress={handleAsk}
          disabled={loading}
        >
          <Text style={styles.askText}>聞く</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B2B20" },

  table: { flex: 1, backgroundColor: "#0F3D2E", padding: 12 },
  tableInfo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tableInfoText: { color: "#A9C8B8", fontSize: 13 },

  sceneRow: { marginTop: 8, maxHeight: 34 },
  sceneChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#1A4536",
    marginRight: 6,
  },
  sceneChipOn: { backgroundColor: "#E8B84B" },
  sceneText: { color: "#A9C8B8", fontSize: 11, fontWeight: "600" },
  sceneTextOn: { color: "#1A1A1A" },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  tag: {
    color: "#A9C8B8",
    fontSize: 10,
    backgroundColor: "#1A4536",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    overflow: "hidden",
  },
  tagObjective: {
    color: "#1A1A1A",
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "#E8B84B",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    overflow: "hidden",
  },

  seatRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },
  seat: { alignItems: "center", minWidth: 70 },
  seatName: { color: "#7FA893", fontSize: 11 },
  seatScore: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  badgeRow: { flexDirection: "row", gap: 3, marginTop: 3 },
  riichi: {
    color: "#1A1A1A",
    fontSize: 9,
    fontWeight: "700",
    backgroundColor: "#E85D5D",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  fulou: {
    color: "#1A1A1A",
    fontSize: 9,
    fontWeight: "700",
    backgroundColor: "#7FA893",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },

  riverArea: { flex: 1, marginTop: 10 },
  riverRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 5 },
  riverLabel: { color: "#7FA893", fontSize: 10, width: 30, marginTop: 3 },
  riverTiles: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 2 },
  riverTile: {
    backgroundColor: "#D8D2C0",
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: "center",
  },
  riverTileTsumogiri: { opacity: 0.55 },
  riverTileRiichi: { backgroundColor: "#E85D5D" },
  riverTileText: { fontSize: 10, fontWeight: "600", color: "#1A1A1A" },

  myScore: { alignItems: "center", paddingTop: 6 },

  handArea: { backgroundColor: "#0B2B20", paddingVertical: 10, paddingHorizontal: 8 },
  tile: {
    width: 38,
    height: 54,
    backgroundColor: "#F5F0E1",
    borderRadius: 5,
    marginHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tileSelected: { borderWidth: 3, borderColor: "#E8B84B", transform: [{ translateY: -6 }] },
  tileDraw: { backgroundColor: "#FFFDF5" },
  tileText: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  akaText: { color: "#C62828" },
  drawGap: { width: 14 },
  meld: { flexDirection: "row", marginLeft: 14, alignSelf: "flex-end" },
  meldTile: {
    width: 30,
    height: 42,
    backgroundColor: "#D8D2C0",
    borderRadius: 4,
    marginHorizontal: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  meldTileText: { fontSize: 12, fontWeight: "700", color: "#1A1A1A" },

  coach: { height: 190, backgroundColor: "#12332A", paddingHorizontal: 16, paddingTop: 12 },
  coachHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  coachTitle: { color: "#E8B84B", fontSize: 14, fontWeight: "700" },
  coachMode: { color: "#7FA893", fontSize: 12 },
  badge: {
    backgroundColor: "#C9A227",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeGood: { backgroundColor: "#4CAF7D" },
  badgeBad: { backgroundColor: "#C75D5D" },
  badgeText: { color: "#1A1A1A", fontWeight: "700", fontSize: 13 },
  safeLine: { color: "#8FBCA5", fontSize: 11, marginTop: 6 },
  coachBody: { marginTop: 8 },
  coachText: { color: "#DCE9E2", fontSize: 14, lineHeight: 22 },

  inputArea: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
    backgroundColor: "#12332A",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#0B2B20",
    borderWidth: 1,
    borderColor: "#2A5A48",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontSize: 15,
  },
  askButton: {
    backgroundColor: "#E8B84B",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  askButtonDisabled: { backgroundColor: "#5A6F62" },
  askText: { color: "#1A1A1A", fontSize: 15, fontWeight: "700" },
});