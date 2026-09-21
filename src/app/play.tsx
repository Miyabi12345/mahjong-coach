/**
 * AIと打つ対局画面
 *
 * 対局はサーバー（mahjong-api の game-api.js）が持っている。
 * この画面は「いまの卓」と「できること（choices）」を受け取って表示し、操作を送るだけ。
 * 設計: mahjong-api/docs/設計_対局の進行.md
 *
 * ④ で作ったもの: 打牌、リーチ・ツモ・ロン・鳴き・カン・見送りのボタン、局と半荘の結果（簡易）
 * ⑥ で足したもの: コーチへの質問（切る前の相談／直前の打牌の振り返り）、👍/👎
 */
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Board } from "../components/Board";
import { TileFace } from "../components/TileFace";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  askInGame,
  sendAction,
  sendFeedback,
  startGame,
  type Action,
  type GameEvent,
  type GameResponse,
  type GameView,
  type Meld,
  type RiverTile,
  type TileChoice,
} from "../api/game";
import { getMatchConfig, setMatchConfig } from "../store/matchStore";
import { OBJECTIVES } from "../types/config";

const SEAT_NAMES = ["自分", "下家", "対面", "上家"];

/**
 * リーチ後に1巡ずつ自動で進める間隔（ミリ秒）
 * みやびさんの確認で 0.8秒は短すぎたので2秒にした（2026-09-20）
 */
const RIICHI_STEP_MS = 2000;

/**
 * 他家の打牌を1枚ずつ見せる間隔（ミリ秒）
 * 0.8秒では速くて順番が追いにくいとのことで 1.2秒にした（2026-09-20）
 * ⚠️ 根拠のある値ではない。打ち心地を見て決め直す
 */
const DISCARD_INTERVAL_MS = 1200;

/**
 * 再生が終わった直後、操作ボタンを出すまでの待ち（ミリ秒）
 * 「早送り」を押した指が、同じ場所に出てきた「ポン」などを押してしまうのを防ぐ
 * （ブラウザで確認したとき、早送りのつもりでポンしてしまった）
 */
const AFTER_PLAYBACK_GUARD_MS = 500;

/** 再生で1つずつ見せる出来事 */
const PLAYBACK_TYPES = ["dapai", "fulou", "gang"];

/**
 * 出来事を1つ、表示中の卓に反映する（再生用）
 * サーバーは「次に自分の番が来るまで」の出来事をまとめて返すので、
 * アプリで1つずつ卓に足して見せる。再生が終わったら、サーバーの卓（最終形）に置き換える。
 */
function applyEvent(v: GameView, e: GameEvent, last: { seat: number | null }): GameView {
  const n: GameView = JSON.parse(JSON.stringify(v));
  const s = n.seats[e.seat];
  if (!s) return n;
  if (e.type === "dapai") {
    s.river.push({ p: e.p, tsumogiri: !!e.tsumogiri, riichi: !!e.riichi, called: false });
    if (e.riichi) s.riichi = true;
    if (e.seat === 0) {
      // 自分の打牌（リーチ後のツモ切りなど）。手牌から抜く
      if (n.me.draw === e.p) n.me.draw = null;
      else {
        const i = n.me.hand.indexOf(e.p);
        if (i >= 0) n.me.hand.splice(i, 1);
        if (n.me.draw) { n.me.hand.push(n.me.draw); n.me.draw = null; }
      }
    }
    last.seat = e.seat;
  } else if (e.type === "fulou") {
    // 鳴かれた牌は、直前に切った人の河の最後の牌
    if (last.seat != null) {
      const r = n.seats[last.seat].river;
      if (r.length) r[r.length - 1].called = true;
    }
    s.fulou.push({ tiles: e.fulou, raw: e.raw });
  } else if (e.type === "gang") {
    s.fulou.push({ tiles: e.gang, raw: e.raw });   // 加槓などは、再生の最後にサーバーの形に置き換わる
  }
  return n;
}
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
  const { width: winWidth } = useWindowDimensions();
  const { rule, objective, level, showRating } = getMatchConfig();
  const objectiveLabel = OBJECTIVES.find((o) => o.id === objective)?.label ?? "標準";

  const [game, setGame] = useState<GameResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ tile: string; isDraw: boolean } | null>(null);
  const [riichiMode, setRiichiMode] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  // 直前の打牌の ○×（手の進み）と、その説明（#26。2026-09-21）
  //   widest       … × のとき、有効牌がいちばん多い打牌（それを切れば○だった）
  //   aiSameReason … AI推奨と同じなのに × のとき、AI がなぜ有効牌の少ないほうを選んだか
  const [rating, setRating] = useState<{
    discard: string;
    rating: string | null;
    recommended: string | null;
    widest?: { discard: string; acceptCount: number; mine: number | null; shanten: number; mineShanten: number | null } | null;
    aiSameReason?: string | null;
  } | null>(null);

  // 再生（他家の打牌を1枚ずつ見せる）
  const [display, setDisplay] = useState<GameView | null>(null);   // いま画面に出している卓
  const [playing, setPlaying] = useState(false);
  // 早送り（オンなら他家の打牌を1枚ずつ見せず、すぐ出す）。対局中いつでも切り替えられる
  const [fastForward, setFastForward] = useState(!!getMatchConfig().fastForward);
  const fastRef = useRef(fastForward);
  const [guard, setGuard] = useState(false);   // 再生直後の押し間違い防止
  const guardRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayRef = useRef<GameView | null>(null);
  const finalRef = useRef<GameView | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // コーチへの質問（⑥）。質問は OpenAI を呼ぶので、「聞く」を押したときだけ送る
  const [question, setQuestion] = useState("");
  const [askTarget, setAskTarget] = useState<"now" | "last">("now");
  const [asking, setAsking] = useState(false);
  const [coach, setCoach] = useState<{
    questionId: string;
    question: string;
    label: string;
    answer: string;
  } | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);
  // 評価: null=まだ / "bad"=👎 を押して一言を書いているところ / "sent"=送った
  const [feedback, setFeedback] = useState<null | "bad" | "sent">(null);
  const [comment, setComment] = useState("");

  const show = (v: GameView) => {
    displayRef.current = v;
    setDisplay(v);
  };

  /** 再生を飛ばして、サーバーの卓（最終形）を出す */
  const finishPlayback = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (finalRef.current) show(finalRef.current);
    setPlaying(false);
    setGuard(true);
    if (guardRef.current) clearTimeout(guardRef.current);
    guardRef.current = setTimeout(() => setGuard(false), AFTER_PLAYBACK_GUARD_MS);
  };

  /** 返事の出来事を1つずつ再生する */
  const startPlayback = (res: GameResponse) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    finalRef.current = res.view;

    // 新しい局が始まっていたら、空の卓から再生する
    const qipaiAt = res.events.map((e) => e.type).lastIndexOf("qipai");
    let base: GameView | null;
    if (qipaiAt >= 0) {
      base = {
        ...res.view,
        seats: res.view.seats.map((s) => ({ ...s, river: [], fulou: [], riichi: false })),
        me: { ...res.view.me, draw: null },
      };
    } else {
      base = displayRef.current;
    }
    const evs = res.events.slice(qipaiAt + 1).filter((e) => PLAYBACK_TYPES.includes(e.type));
    if (fastRef.current || !base || !evs.length) {
      show(res.view);
      setPlaying(false);
      return;
    }

    show(base);
    setPlaying(true);
    let cur = base;
    let i = 0;
    const last = { seat: null as number | null };
    // 自分の打牌はすぐ、他家の打牌は少し間をあけて見せる
    const delayOf = (e?: GameEvent) => (e && e.seat === 0 ? 0 : DISCARD_INTERVAL_MS);
    const step = () => {
      if (i >= evs.length) {
        finishPlayback();
        return;
      }
      cur = applyEvent(cur, evs[i++], last);
      show(cur);
      timerRef.current = setTimeout(step, delayOf(evs[i]));
    };
    timerRef.current = setTimeout(step, delayOf(evs[0]));
  };

  const toggleFastForward = () => {
    const on = !fastRef.current;
    fastRef.current = on;
    setFastForward(on);
    setMatchConfig({ ...getMatchConfig(), fastForward: on });   // 次の対局でも同じにする
    if (on && timerRef.current) finishPlayback();   // 再生中にオンにしたら、残りをすぐ出す
  };

  // 画面を閉じたら再生を止める
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (guardRef.current) clearTimeout(guardRef.current);
  }, []);

  const apply = (res: GameResponse) => {
    setGame(res);
    startPlayback(res);
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
    if (r) setRating({ discard: r.discard, rating: r.rating, recommended: r.recommended, widest: r.widest, aiSameReason: r.aiSameReason });
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
    if (!riichiAuto || busy || playing) return;
    const t = setTimeout(() => act({ action: "next" }), RIICHI_STEP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, busy, playing]);

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

  // 再生中は、再生している卓を出し、操作はできないようにする
  const view = display ?? game.view;
  const choices = playing || guard ? null : game.choices;
  const me = view.seats[0];
  const zimo = choices?.type === "zimo" ? choices : null;
  const call = choices?.type === "call" ? choices : null;

  // 質問できる対象。振り返りはこの局で切ったあと。
  // 「いまの局面」は、自分のツモ番（何を切るか）と、鳴ける場面（鳴くかどうか）の両方
  // （どちらの相談になるかはサーバーが決める。2026-09-21 に鳴きの場面を足した）
  const askCall = game.choices?.type === "call" ? game.choices : null;
  // 和了れる場面は、和了るかどうかの相談になる（サーバーが決める。Phase 2。2026-09-21）
  const askHuleKind =
    (game.choices?.type === "zimo" || game.choices?.type === "call") && game.choices.hule
      ? game.choices.type === "zimo" ? "ツモ" : "ロン"
      : null;
  const canAskNow = (game.choices?.type === "zimo" || !!askCall) && !playing;
  const canAskLast = !!rating;
  const target: "now" | "last" | null =
    askTarget === "now"
      ? canAskNow ? "now" : canAskLast ? "last" : null
      : canAskLast ? "last" : canAskNow ? "now" : null;

  const handleAsk = async () => {
    if (!target || asking) return;
    const q =
      question.trim() ||
      (target === "last" ? "この打牌はどうだった？" : askHuleKind ? `${askHuleKind}するべき？` : askCall ? "鳴くべき？" : "何を切ればいい？");
    // 切る前に牌を選んでいたら「その牌を切ったら」で聞く（鳴きの相談では使わない）
    const discard = target === "now" && !askCall && !askHuleKind && selected ? selected.tile : undefined;
    const label =
      target === "last"
        ? `直前の打牌（${tileText(rating!.discard)}切り）`
        : askHuleKind
          ? `和了の相談（${askHuleKind}${askCall?.tile ? ` ${tileText(askCall.tile)}` : ""}）`
        : askCall
          ? `鳴きの相談（${askCall.tile ? tileText(askCall.tile) : ""}）`
          : discard ? `いまの局面（${tileText(discard)}を切るなら）` : "いまの局面";
    setAsking(true);
    setCoachError(null);
    try {
      const r = await askInGame(game.gameId, q, target, discard);
      setCoach({ questionId: r.questionId, question: q, label, answer: r.answer });
      setFeedback(null);
      setComment("");
      setQuestion("");
    } catch (e: any) {
      setCoachError(`質問できませんでした。${e.message}`);
    } finally {
      setAsking(false);
    }
  };

  const handleFeedback = async (good: boolean, text?: string) => {
    if (!coach) return;
    try {
      await sendFeedback(game.gameId, coach.questionId, good, text?.trim() || undefined);
      setFeedback("sent");
    } catch (e: any) {
      setCoachError(`評価を送れませんでした。${e.message}`);
    }
  };

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
  // 盤面の一辺：画面の幅に合わせる（大きい画面では 520 まで）
  const boardSize = Math.min(winWidth - 16, 520);
  const roundLabel = `${WIND[r.zhuangfeng]}${r.jushu + 1}局 ${r.changbang}本場${r.lizhibang ? ` 供託${r.lizhibang}` : ""}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* 上：局の情報 */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Text style={styles.dim}>← やめる</Text>
        </TouchableOpacity>
        {/* 局・ドラ・残り枚数は、盤面の中央に出す（2026-09-22） */}
        <Text style={styles.round}>{roundLabel}</Text>
      </View>

      <ScrollView style={styles.table} contentContainerStyle={{ paddingBottom: 8 }}>
        {/* 卓：中央に局の情報、まわりに4人の河（天鳳のような配置。2026-09-22 みやびさんの要望） */}
        <View style={{ paddingTop: 8 }}>
          <Board view={{ ...view, round: r }} size={boardSize} />
        </View>

        {/* 直前の出来事 */}
        {recent.length > 0 && <Text style={styles.recent}>{recent.join("　")}</Text>}
      </ScrollView>

      {/* 直前の打牌の ○× と AI推奨 */}
      {/* ○× は「手の進み」だけを見る（9/19 の決定のまま）。× のときは理由を添える（#26。2026-09-21）
          以前は「1m切り × AIなら1m切り」と矛盾して見えた */}
      {rating && (
        <View style={styles.ratingRow}>
          <View style={styles.ratingLine}>
            <Text style={styles.dim}>{tileText(rating.discard)}切り</Text>
            {showRating !== false && rating.rating && (
              <>
                <Text style={styles.dim}>手の進み</Text>
                <View style={[styles.badge, rating.rating === "○" ? styles.badgeGood : styles.badgeBad]}>
                  <Text style={styles.badgeText}>{rating.rating}</Text>
                </View>
                {rating.rating === "×" && rating.widest && (
                  <Text style={styles.dim}>
                    {rating.widest.mineShanten != null && rating.widest.mineShanten !== rating.widest.shanten
                      ? `${tileText(rating.widest.discard)}切りなら手を戻さずに済む`
                      : `${tileText(rating.widest.discard)}切りなら有効牌${rating.widest.acceptCount}枚` +
                        (rating.widest.mine != null ? `（${tileText(rating.discard)}切りは${rating.widest.mine}枚）` : "")}
                  </Text>
                )}
              </>
            )}
          </View>
          {rating.recommended && (
            <Text style={styles.dim}>
              {rating.recommended === rating.discard
                ? `AIと同じ${showRating !== false && rating.rating === "×" && rating.aiSameReason ? `：${rating.aiSameReason}` : ""}`
                : `AIなら ${tileText(rating.recommended)}切り`}
            </Text>
          )}
        </View>
      )}

      {/* コーチの回答と 👍/👎 */}
      {(coach || asking || coachError) && (
        <View style={styles.coachPanel}>
          <View style={styles.coachHead}>
            <Text style={styles.coachTitle}>コーチ</Text>
            {coach && !asking && (
              <Text style={[styles.dim, { flex: 1 }]} numberOfLines={1}>
                {coach.label}「{coach.question}」
              </Text>
            )}
            {(asking || !coach) && <View style={{ flex: 1 }} />}
            {!asking && (
              <TouchableOpacity onPress={() => { setCoach(null); setCoachError(null); }}>
                <Text style={styles.dim}>閉じる ×</Text>
              </TouchableOpacity>
            )}
          </View>
          {asking && <ActivityIndicator color="#E8B84B" style={{ marginVertical: 8 }} />}
          {coachError && <Text style={styles.errorText}>{coachError}</Text>}
          {coach && !asking && (
            <>
              <ScrollView style={styles.coachBody}>
                <Text style={styles.coachText}>{coach.answer}</Text>
              </ScrollView>
              {feedback === "sent" ? (
                <Text style={styles.dim}>評価を送りました。ありがとうございます</Text>
              ) : feedback === "bad" ? (
                <View style={styles.feedbackRow}>
                  <TextInput
                    style={[styles.input, styles.commentInput]}
                    value={comment}
                    onChangeText={setComment}
                    placeholder="よくなかった点を一言（書かなくても送れます）"
                    placeholderTextColor="#5A7A6B"
                    onSubmitEditing={() => handleFeedback(false, comment)}
                  />
                  <Btn label="送る" strong onPress={() => handleFeedback(false, comment)} />
                </View>
              ) : (
                <View style={styles.feedbackRow}>
                  <Text style={styles.dim}>この回答は役に立ちましたか？</Text>
                  <Btn label="👍" onPress={() => handleFeedback(true)} />
                  <Btn label="👎" onPress={() => setFeedback("bad")} />
                </View>
              )}
            </>
          )}
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

      {/* 操作（右端に早送りのスイッチ。いつでも切り替えられる） */}
      <View style={styles.actions}>
      <View style={styles.actionsMain}>
        {busy && !playing && <ActivityIndicator color="#E8B84B" />}
        {playing && (
          <View style={styles.buttonRow}>
            <Text style={styles.dim}>他家が打っています…</Text>
          </View>
        )}
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

        {game.ended && !playing && (
          <View style={styles.buttonRow}>
            <Btn label="もう一度打つ" strong onPress={() => { setGame(null); setRating(null); setRecent([]); begin(); }} />
            <Btn label="ホームへ" onPress={() => router.replace("/")} />
          </View>
        )}
      </View>
        {/* みやびさんの確認で、毎回押す「早送り」ボタンは使いにくかったので、スイッチ1つにした（2026-09-20） */}
        <View style={styles.ffSwitch}>
          <Text style={[styles.ffSwitchText, fastForward && styles.ffSwitchTextOn]}>早送り</Text>
          <Switch
            value={fastForward}
            onValueChange={toggleFastForward}
            trackColor={{ false: "#3A5A4A", true: "#E8B84B" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* 質問欄。「いまの局面」は自分の番だけ、「直前の打牌」はこの局で切ったあと */}
      {!game.ended && (
        <View style={styles.askArea}>
          <View style={styles.askTargets}>
            <TargetChip
              label={
                askHuleKind ? `${askHuleKind}するか`
                  : askCall ? `この${askCall.tile ? tileText(askCall.tile) : "鳴き"}を鳴くか`
                  : selected && canAskNow ? `${tileText(selected.tile)}を切るなら`
                  : "いまの局面"
              }
              active={target === "now"}
              enabled={canAskNow}
              onPress={() => setAskTarget("now")}
            />
            <TargetChip
              label={rating ? `直前の${tileText(rating.discard)}切り` : "直前の打牌"}
              active={target === "last"}
              enabled={canAskLast}
              onPress={() => setAskTarget("last")}
            />
          </View>
          <View style={styles.askRow}>
            <TextInput
              style={styles.input}
              value={question}
              onChangeText={setQuestion}
              placeholder={
                !target ? "自分の番か、切ったあとに質問できます"
                  : askHuleKind && target === "now" ? `コーチに質問（空なら「${askHuleKind}するべき？」）`
                  : askCall && target === "now" ? "コーチに質問（空なら「鳴くべき？」）"
                  : "コーチに質問（空なら「何を切ればいい？」）"
              }
              placeholderTextColor="#5A7A6B"
              editable={!!target && !asking}
              onSubmitEditing={handleAsk}
            />
            <TouchableOpacity
              style={[styles.askButton, (!target || asking) && styles.askButtonDisabled]}
              onPress={handleAsk}
              disabled={!target || asking}
            >
              <Text style={styles.askText}>聞く</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
      <TileFace tile={tile} size="hand" />
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
      <TileFace tile={t.p} size="river" />
    </View>
  );
}

function MeldView({ meld, small, dora = [] }: { meld: Meld; small?: boolean; dora?: string[] }) {
  return (
    <View style={[styles.meld, small && { marginLeft: 6 }]}>
      {splitMeld(meld.tiles).map((t, i) => (
        <View key={i} style={[small ? styles.meldTileSmall : styles.meldTile, isDora(t, dora) && styles.doraTile]}>
          <TileFace tile={t} size={small ? "small" : "meld"} />
        </View>
      ))}
    </View>
  );
}

/** 質問の対象を選ぶ（いまの局面／直前の打牌） */
function TargetChip({
  label,
  active,
  enabled,
  onPress,
}: {
  label: string;
  active: boolean;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, !enabled && styles.tileDisabled]}
      onPress={onPress}
      disabled={!enabled}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
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
  // 牌は絵（TileFace）。ここでは枠と状態だけを付ける
  riverTile: { borderRadius: 3, overflow: "hidden" },
  riverTileTsumogiri: { opacity: 0.55 },
  riverTileRiichi: { borderWidth: 2, borderColor: "#E85D5D" },
  riverTileCalled: { borderWidth: 1, borderColor: "#E8B84B", opacity: 0.4 },
  riverTileText: { fontSize: 10, fontWeight: "600", color: "#1A1A1A" },
  recent: { color: "#DCE9E2", fontSize: 12, marginTop: 10 },

  ratingRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 2,
    backgroundColor: "#12332A",
  },
  ratingLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  badgeGood: { backgroundColor: "#4CAF7D" },
  badgeBad: { backgroundColor: "#C75D5D" },
  badgeText: { color: "#1A1A1A", fontWeight: "700", fontSize: 12 },

  handArea: { backgroundColor: "#0B2B20", paddingVertical: 10, paddingHorizontal: 8 },
  tile: { borderRadius: 5, marginHorizontal: 1, overflow: "hidden" },
  tileSelected: { borderWidth: 3, borderColor: "#E8B84B", transform: [{ translateY: -6 }] },
  tileDisabled: { opacity: 0.45 },
  tileText: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  akaText: { color: "#C62828" },
  meld: { flexDirection: "row", marginLeft: 12, alignSelf: "flex-end" },
  meldTile: { borderRadius: 4, marginHorizontal: 1, overflow: "hidden" },
  meldTileSmall: { borderRadius: 3, marginHorizontal: 1, overflow: "hidden" },
  meldTileText: { fontSize: 12, fontWeight: "700", color: "#1A1A1A" },

  actions: { backgroundColor: "#12332A", paddingHorizontal: 12, paddingVertical: 10, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12 },
  actionsMain: { flex: 1, gap: 8 },
  ffSwitch: { flexDirection: "row", alignItems: "center", gap: 6 },
  ffSwitchText: { color: "#A8C5B5", fontSize: 13 },
  ffSwitchTextOn: { color: "#E8B84B", fontWeight: "700" },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  button: { backgroundColor: "#1A5C46", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  buttonStrong: { backgroundColor: "#E8B84B" },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  buttonTextStrong: { color: "#1A1A1A" },
  callTile: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginRight: 4 },
  result: { gap: 4, marginBottom: 8 },
  resultTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  // コーチ（⑥）。見た目は練習問題の画面（game.tsx）に合わせた
  coachPanel: {
    backgroundColor: "#12332A",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#2A5A48",
  },
  coachHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  coachTitle: { color: "#E8B84B", fontSize: 14, fontWeight: "700" },
  coachBody: { maxHeight: 180 },
  coachText: { color: "#DCE9E2", fontSize: 14, lineHeight: 22 },
  feedbackRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  commentInput: { paddingVertical: 8, fontSize: 13 },
  askArea: {
    backgroundColor: "#12332A",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#2A5A48",
  },
  askTargets: { flexDirection: "row", gap: 8, paddingTop: 8 },
  chip: { borderWidth: 1, borderColor: "#2A5A48", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  chipActive: { backgroundColor: "#E8B84B", borderColor: "#E8B84B" },
  chipText: { color: "#A9C8B8", fontSize: 12 },
  chipTextActive: { color: "#1A1A1A", fontWeight: "700" },
  askRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: "#0B2B20",
    borderWidth: 1,
    borderColor: "#2A5A48",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
  },
  askButton: { backgroundColor: "#E8B84B", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  askButtonDisabled: { backgroundColor: "#5A6F62" },
  askText: { color: "#1A1A1A", fontSize: 14, fontWeight: "700" },
});
