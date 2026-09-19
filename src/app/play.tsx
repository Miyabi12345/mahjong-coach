/**
 * AIと打つ対局画面
 *
 * 対局はサーバー（mahjong-api の game-api.js）が持っている。
 * この画面は「いまの卓」と「できること（choices）」を受け取って表示し、操作を送るだけ。
 * 設計: mahjong-api/docs/設計_対局の進行.md
 *
 * ④ で作ったもの: 打牌、リーチ・ツモ・ロン・鳴き・カン・見送りのボタン、局と半荘の結果（簡易）
 * ⑥ で足すもの: コーチへの質問、👍/👎
 */
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  sendAction,
  startGame,
  type Action,
  type GameEvent,
  type GameResponse,
  type Meld,
  type RiverTile,
  type TileChoice,
} from "../api/game";
import { getMatchConfig } from "../store/matchStore";
import { OBJECTIVES } from "../types/config";

const SEAT_NAMES = ["自分", "下家", "対面", "上家"];

/**
 * リーチ後に1巡ずつ自動で進める間隔（ミリ秒）
 * ⚠️ とりあえずの値。根拠はない。打ち心地を見て決め直す
 */
const RIICHI_STEP_MS = 800;
const WIND = ["東", "南", "西", "北"];

/** 赤5（0m など）かどうか */
const isAka = (tile: string) => tile.length === 2 && tile[0] === "0";
/** 画面に出す文字。赤5は「5m」と書き、色で区別する */
const tileText = (tile: string) => (isAka(tile) ? `5${tile[1]}` : tile);

/** ドラかどうか。赤5（0m）は5mとして比べる */
const isDora = (tile: string, dora: string[]) =>
  dora.includes(isAka(tile) ? `5${tile[1]}` : tile);

/** "6s7s8s" → ["6s","7s","8s"]。数牌は2文字、字牌は1文字 */
function splitMeld(meld: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < meld.length) {
    if (/[0-9]/.test(meld[i]) && i + 1 < meld.length) {
      out.push(meld.slice(i, i + 2));
      i += 2;
    } else {
      out.push(meld[i]);
      i += 1;
    }
  }
  return out;
}

/**
 * タップした牌を、サーバーに送る表記（raw）に直す
 * ツモ牌をタップしたらツモ切り（raw の末尾が "_"）を優先する。
 */
function rawFor(tile: string, isDraw: boolean, list: TileChoice[]): string | null {
  const same = list.filter((c) => c.p === tile);
  if (!same.length) return null;
  const tsumogiri = same.find((c) => c.raw.endsWith("_"));
  const tedashi = same.find((c) => !c.raw.endsWith("_"));
  return (isDraw ? tsumogiri ?? tedashi : tedashi ?? tsumogiri)?.raw ?? null;
}

/** 出来事を1行の文にする（直前に何が起きたかを見せる） */
function eventText(e: GameEvent): string | null {
  const who = SEAT_NAMES[e.seat] ?? "";
  switch (e.type) {
    case "dapai":
      return `${who}: ${tileText(e.p)}${e.riichi ? " リーチ" : ""}`;
    case "fulou":
      return `${who}: 鳴き ${e.fulou}`;
    case "gang":
      return `${who}: カン ${e.gang}`;
    case "hule":
      return `${who}: 和了`;
    case "pingju":
      return `流局（${e.name}）`;
    default:
      return null;
  }
}

export default function PlayScreen() {
  const router = useRouter();
  const { rule, objective, level, showRating } = getMatchConfig();
  const objectiveLabel = OBJECTIVES.find((o) => o.id === objective)?.label ?? "標準";

  const [game, setGame] = useState<GameResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ tile: string; isDraw: boolean } | null>(null);
  const [riichiMode, setRiichiMode] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [rating, setRating] = useState<{ discard: string; rating: string | null; recommended: string | null } | null>(null);

  const apply = (res: GameResponse) => {
    setGame(res);
    setSelected(null);
    setRiichiMode(false);
    const lines = res.events.map(eventText).filter((x): x is string => !!x);
    if (lines.length) setRecent((prev) => [...prev, ...lines].slice(-4));
    // 新しい局が始まったら、前の局の出来事と ○× を消す
    // （ブラウザで確認したとき、前の局の「3m切り ×」が次の局に残っていた）
    const qipaiAt = res.events.map((e) => e.type).lastIndexOf("qipai");
    if (qipaiAt >= 0) {
      setRecent(res.events.slice(qipaiAt).map(eventText).filter((x): x is string => !!x));
      setRating(null);
    }
    const r = [...res.events.slice(qipaiAt + 1)].reverse().find((e) => e.type === "rating");
    if (r) setRating({ discard: r.discard, rating: r.rating, recommended: r.recommended });
  };

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      apply(await startGame(rule, level, objectiveLabel));
    } catch (e: any) {
      setError(`対局を始められませんでした。\n${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    begin();
    // 画面を開いたときに1回だけ始める
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // リーチ後は、少し待ってから自動で1巡進める（押さなくても最後まで過程が見える）
  const riichiAuto = game?.choices?.type === "riichi_auto";
  useEffect(() => {
    if (!riichiAuto || busy) return;
    const t = setTimeout(() => act({ action: "next" }), RIICHI_STEP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, busy]);

  const act = async (a: Action) => {
    if (!game || busy) return;
    setBusy(true);
    setError(null);
    try {
      apply(await sendAction(game.gameId, a));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!game) {
    return (
      <SafeAreaView style={styles.container}>
        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.button} onPress={begin}>
              <Text style={styles.buttonText}>もう一度</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color="#E8B84B" />
            <Text style={styles.dim}>配牌中…</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const { view, choices } = game;
  const me = view.seats[0];
  const zimo = choices?.type === "zimo" ? choices : null;
  const call = choices?.type === "call" ? choices : null;

  /** 手牌の牌をタップしたとき */
  const onTile = (tile: string, isDraw: boolean) => {
    if (!zimo || busy) return;
    const list = riichiMode ? zimo.lizhi : zimo.dapai;
    const raw = rawFor(tile, isDraw, list);
    if (!raw) return;   // 切れない牌（リーチ後など）
    if (selected && selected.tile === tile && selected.isDraw === isDraw) {
      act({ action: riichiMode ? "lizhi" : "dapai", raw });   // 2回目のタップで切る
    } else {
      setSelected({ tile, isDraw });
    }
  };

  const canCut = (tile: string, isDraw: boolean) =>
    !!zimo && !!rawFor(tile, isDraw, riichiMode ? zimo.lizhi : zimo.dapai);

  // 古いサーバー（ドラの項目がない）でも止まらないように、空の配列にしておく
  const r = { ...view.round, dora: view.round.dora ?? [] };
  const roundLabel = `${WIND[r.zhuangfeng]}${r.jushu + 1}局 ${r.changbang}本場${r.lizhibang ? ` 供託${r.lizhibang}` : ""}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* 上：局の情報 */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Text style={styles.dim}>← やめる</Text>
        </TouchableOpacity>
        <Text style={styles.round}>{roundLabel}</Text>
        <View style={styles.doraBox}>
          <Text style={styles.doraLabel}>ドラ</Text>
          {r.dora.map((d, i) => (
            <View key={i} style={[styles.riverTile, styles.doraTile]}>
              <Text style={[styles.riverTileText, isAka(d) && styles.akaText]}>{tileText(d)}</Text>
            </View>
          ))}
          <Text style={styles.dim}>（表示 {r.baopai.map(tileText).join(" ")}）  残り {r.paishu ?? "-"}</Text>
        </View>
      </View>

      <ScrollView style={styles.table} contentContainerStyle={{ paddingBottom: 8 }}>
        {/* 他家（上家・対面・下家）と自分の河 */}
        {[3, 2, 1, 0].map((rel) => {
          const s = view.seats[rel];
          return (
            <View key={rel} style={styles.seatBlock}>
              <View style={styles.seatHead}>
                <Text style={styles.seatName}>
                  {s.name}（{WIND[s.menfeng]}）
                </Text>
                <Text style={styles.score}>{s.score.toLocaleString()}</Text>
                {s.riichi && <Text style={styles.riichiBadge}>リーチ</Text>}
                {s.fulou.map((m, i) => (
                  <MeldView key={i} meld={m} small dora={r.dora} />
                ))}
              </View>
              <View style={styles.river}>
                {s.river.map((t, i) => (
                  <RiverTileView key={i} t={t} dora={r.dora} />
                ))}
              </View>
            </View>
          );
        })}

        {/* 直前の出来事 */}
        {recent.length > 0 && <Text style={styles.recent}>{recent.join("　")}</Text>}
      </ScrollView>

      {/* 直前の打牌の ○× と AI推奨 */}
      {rating && (
        <View style={styles.ratingRow}>
          <Text style={styles.dim}>{tileText(rating.discard)}切り</Text>
          {showRating !== false && rating.rating && (
            <View style={[styles.badge, rating.rating === "○" ? styles.badgeGood : styles.badgeBad]}>
              <Text style={styles.badgeText}>{rating.rating}</Text>
            </View>
          )}
          {rating.recommended && <Text style={styles.dim}>AIなら {tileText(rating.recommended)}切り</Text>}
        </View>
      )}

      {/* 手牌 */}
      <View style={styles.handArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {view.me.hand.map((tile, i) => (
            <TileButton
              key={i}
              tile={tile}
              selected={selected?.tile === tile && !selected.isDraw}
              dora={isDora(tile, r.dora)}
              enabled={canCut(tile, false)}
              onPress={() => onTile(tile, false)}
            />
          ))}
          {view.me.draw && (
            <>
              <View style={{ width: 12 }} />
              <TileButton
                tile={view.me.draw}
                selected={selected?.tile === view.me.draw && !!selected?.isDraw}
                dora={isDora(view.me.draw, r.dora)}
                enabled={canCut(view.me.draw, true)}
                onPress={() => onTile(view.me.draw!, true)}
              />
            </>
          )}
          {me.fulou.map((m, i) => (
            <MeldView key={i} meld={m} dora={r.dora} />
          ))}
        </ScrollView>
      </View>

      {/* 操作 */}
      <View style={styles.actions}>
        {busy && <ActivityIndicator color="#E8B84B" />}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {zimo && !busy && (
          <View style={styles.buttonRow}>
            {zimo.hule && <Btn label="ツモ" strong onPress={() => act({ action: "hule" })} />}
            {zimo.lizhi.length > 0 && (
              <Btn
                label={riichiMode ? "リーチをやめる" : "リーチ"}
                strong={!riichiMode}
                onPress={() => {
                  setRiichiMode(!riichiMode);
                  setSelected(null);
                }}
              />
            )}
            {zimo.gang.map((m) => (
              <Btn key={m.raw} label={`カン ${m.tiles}`} onPress={() => act({ action: "gang", raw: m.raw })} />
            ))}
            {zimo.pingju && <Btn label="九種九牌" onPress={() => act({ action: "pingju" })} />}
            {selected && (
              <Btn
                label={`${tileText(selected.tile)}を切る`}
                strong
                onPress={() => onTile(selected.tile, selected.isDraw)}
              />
            )}
            {!selected && (
              <Text style={styles.dim}>
                {riichiMode ? "リーチして切る牌を選んでください" : "切る牌をタップ（もう一度タップで切る）"}
              </Text>
            )}
          </View>
        )}

        {call && !busy && (
          <View style={styles.buttonRow}>
            {call.tile && <Text style={styles.callTile}>{tileText(call.tile)}</Text>}
            {call.hule && <Btn label="ロン" strong onPress={() => act({ action: "hule" })} />}
            {[...call.chi.map((m) => ({ m, k: "チー" })), ...call.peng.map((m) => ({ m, k: "ポン" })), ...call.gang.map((m) => ({ m, k: "カン" }))].map(
              ({ m, k }) => (
                <Btn key={k + m.raw} label={`${k} ${m.tiles}`} onPress={() => act({ action: "fulou", raw: m.raw })} />
              )
            )}
            {call.daopai && <Btn label="テンパイ宣言" onPress={() => act({ action: "daopai" })} />}
            <Btn label="見送り" onPress={() => act({ action: "pass" })} />
          </View>
        )}

        {choices?.type === "riichi_auto" && (
          <View style={styles.buttonRow}>
            <Text style={styles.dim}>リーチ中（自動でツモ切り）</Text>
            <Btn label="結果まで飛ばす" strong onPress={() => act({ action: "skip" })} />
          </View>
        )}

        {choices?.type === "daopai" && !busy && (
          <View style={styles.buttonRow}>
            <Btn label="テンパイ宣言" strong onPress={() => act({ action: "daopai" })} />
            <Btn label="しない" onPress={() => act({ action: "pass" })} />
          </View>
        )}

        {choices?.type === "kyoku_end" && !busy && (
          <View>
            <ResultView result={game.result} />
            <Btn label="次の局へ" strong onPress={() => act({ action: "next" })} />
          </View>
        )}

        {choices?.type === "game_end" && !busy && (
          <View>
            <ResultView result={game.result} />
            <Btn label="終わる" strong onPress={() => act({ action: "next" })} />
          </View>
        )}

        {game.ended && (
          <View style={styles.buttonRow}>
            <Btn label="もう一度打つ" strong onPress={() => { setGame(null); setRating(null); setRecent([]); begin(); }} />
            <Btn label="ホームへ" onPress={() => router.replace("/")} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// 部品
// ============================================================

function TileButton({
  tile,
  selected,
  enabled,
  dora,
  onPress,
}: {
  tile: string;
  selected: boolean;
  enabled: boolean;
  dora?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tile, dora && styles.doraTile, selected && styles.tileSelected, !enabled && styles.tileDisabled]}
      onPress={onPress}
      disabled={!enabled}
    >
      <Text style={[styles.tileText, isAka(tile) && styles.akaText]}>{tileText(tile)}</Text>
    </TouchableOpacity>
  );
}

function RiverTileView({ t, dora }: { t: RiverTile; dora: string[] }) {
  return (
    <View
      style={[
        styles.riverTile,
        isDora(t.p, dora) && styles.doraTile,
        t.riichi && styles.riverTileRiichi,
        t.tsumogiri && styles.riverTileTsumogiri,
        t.called && styles.riverTileCalled,
      ]}
    >
      <Text style={[styles.riverTileText, isAka(t.p) && styles.akaText]}>{tileText(t.p)}</Text>
    </View>
  );
}

function MeldView({ meld, small, dora = [] }: { meld: Meld; small?: boolean; dora?: string[] }) {
  return (
    <View style={[styles.meld, small && { marginLeft: 6 }]}>
      {splitMeld(meld.tiles).map((t, i) => (
        <View key={i} style={[small ? styles.meldTileSmall : styles.meldTile, isDora(t, dora) && styles.doraTile]}>
          <Text style={[small ? styles.riverTileText : styles.meldTileText, isAka(t) && styles.akaText]}>
            {tileText(t)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Btn({ label, onPress, strong }: { label: string; onPress: () => void; strong?: boolean }) {
  return (
    <TouchableOpacity style={[styles.button, strong && styles.buttonStrong]} onPress={onPress}>
      <Text style={[styles.buttonText, strong && styles.buttonTextStrong]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** 局・半荘の結果（簡易。見た目は⑤で仕上げる） */
function ResultView({ result }: { result: GameEvent | null }) {
  if (!result) return null;
  if (result.type === "hule") {
    const who = SEAT_NAMES[result.seat];
    const from = result.from == null ? "ツモ" : `${SEAT_NAMES[result.from]}から`;
    const yaku = (result.hupai ?? []).map((h: any) => `${h.name}${h.fanshu}`).join(" ");
    return (
      <View style={styles.result}>
        <Text style={styles.resultTitle}>
          {who}の和了（{from}） {result.defen}点
        </Text>
        <Text style={styles.dim}>{yaku}</Text>
        {result.uradora && (
          <Text style={styles.dim}>
            裏ドラ {result.uradora.map(tileText).join(" ")}（表示 {result.fubaopai.map(tileText).join(" ")}）
          </Text>
        )}
        <Fenpei fenpei={result.fenpei} />
      </View>
    );
  }
  if (result.type === "pingju") {
    return (
      <View style={styles.result}>
        <Text style={styles.resultTitle}>流局（{result.name}）</Text>
        <Fenpei fenpei={result.fenpei} />
      </View>
    );
  }
  if (result.type === "jieju") {
    const id = result.humanId;
    return (
      <View style={styles.result}>
        <Text style={styles.resultTitle}>
          終局　あなたは{result.rank?.[id]}位（{result.defen?.[id]?.toLocaleString()}点 / {result.point?.[id]}）
        </Text>
      </View>
    );
  }
  return null;
}

function Fenpei({ fenpei }: { fenpei: number[] | null }) {
  if (!fenpei) return null;
  return (
    <Text style={styles.dim}>
      {fenpei.map((v, i) => `${SEAT_NAMES[i]} ${v > 0 ? "+" : ""}${v}`).join("　")}
    </Text>
  );
}

// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B2B20" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  dim: { color: "#A9C8B8", fontSize: 12 },
  errorText: { color: "#F2A5A5", fontSize: 13 },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0F3D2E",
  },
  round: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  doraBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  doraLabel: { color: "#E8B84B", fontSize: 13, fontWeight: "700" },
  // ドラの牌の印（金色の枠）
  doraTile: { borderWidth: 2, borderColor: "#E8B84B" },

  table: { flex: 1, backgroundColor: "#0F3D2E", paddingHorizontal: 12 },
  seatBlock: { marginTop: 8 },
  seatHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  seatName: { color: "#7FA893", fontSize: 12 },
  score: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  riichiBadge: {
    color: "#1A1A1A",
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "#E85D5D",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  river: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 4 },
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
  riverTileCalled: { borderWidth: 1, borderColor: "#E8B84B", opacity: 0.4 },
  riverTileText: { fontSize: 10, fontWeight: "600", color: "#1A1A1A" },
  recent: { color: "#DCE9E2", fontSize: 12, marginTop: 10 },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#12332A",
  },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  badgeGood: { backgroundColor: "#4CAF7D" },
  badgeBad: { backgroundColor: "#C75D5D" },
  badgeText: { color: "#1A1A1A", fontWeight: "700", fontSize: 12 },

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
  tileDisabled: { opacity: 0.45 },
  tileText: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  akaText: { color: "#C62828" },
  meld: { flexDirection: "row", marginLeft: 12, alignSelf: "flex-end" },
  meldTile: {
    width: 30,
    height: 42,
    backgroundColor: "#D8D2C0",
    borderRadius: 4,
    marginHorizontal: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  meldTileSmall: {
    backgroundColor: "#D8D2C0",
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginHorizontal: 1,
  },
  meldTileText: { fontSize: 12, fontWeight: "700", color: "#1A1A1A" },

  actions: { backgroundColor: "#12332A", paddingHorizontal: 12, paddingVertical: 10, minHeight: 64, gap: 8 },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  button: { backgroundColor: "#1A5C46", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  buttonStrong: { backgroundColor: "#E8B84B" },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  buttonTextStrong: { color: "#1A1A1A" },
  callTile: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginRight: 4 },
  result: { gap: 4, marginBottom: 8 },
  resultTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
