import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMatchConfig, setMatchConfig } from "../store/matchStore";
import {
  CHIP_VALUE_PRESETS,
  DEFAULT_UMA_OKA,
  EXTRA_GAME_OPTIONS,
  getPresets,
  MULTI_RON_OPTIONS,
  ObjectiveId,
  OBJECTIVES,
  PLAYER_LEVELS,
  PlayerLevel,
  RENCHAN_OPTIONS,
  SANMA_AVAILABLE,
  START_POINTS
} from "../types/config";

export default function SettingsScreen() {
  const router = useRouter();
  const saved = getMatchConfig();
  const [rule, setRule] = useState(saved.rule);
  const [objective, setObjective] = useState<ObjectiveId>(saved.objective);
  const [showDetail, setShowDetail] = useState(false);
  const [level, setLevel] = useState<PlayerLevel>(saved.level);
  const [showRating, setShowRating] = useState<boolean>(saved.showRating ?? true);

  const isSanma = rule.playerCount === 3;
  const presets = getPresets(rule.playerCount);
  const points = START_POINTS[rule.playerCount];

  const changePlayerCount = (n: 4 | 3) => {
    if (n === 3 && !SANMA_AVAILABLE) return;
    setRule({ ...rule, playerCount: n, umaOka: DEFAULT_UMA_OKA[n] });
  };

  /** ON/OFFのトグル行 */
  const Toggle = ({
    label,
    note,
    value,
    onChange,
  }: {
    label: string;
    note?: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <View style={styles.card}>
      <View style={styles.switchRow}>
        <View style={styles.labelBlock}>
          <Text style={styles.label}>{label}</Text>
          {note ? <Text style={styles.hintTight}>{note}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ true: "#E8B84B", false: "#3A5A4C" }}
        />
      </View>
    </View>
  );

  /** 2択・3択のセグメント */
  const Segment = <T extends string>({
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: { id: T; label: string; note: string }[];
    value: T;
    onChange: (v: T) => void;
  }) => (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segment}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={[styles.segItem, value === o.id && styles.segItemOn]}
            onPress={() => onChange(o.id)}
          >
            <Text style={[styles.segText, value === o.id && styles.segTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>{options.find((o) => o.id === value)?.note}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>対局設定</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* ===== 対局形式 ===== */}
        <Text style={styles.section}>対局形式</Text>

        <View style={styles.card}>
          <Text style={styles.label}>人数</Text>
          <View style={styles.segment}>
            {([4, 3] as const).map((n) => {
              const disabled = n === 3 && !SANMA_AVAILABLE;
              return (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.segItem,
                    rule.playerCount === n && styles.segItemOn,
                    disabled && styles.segItemOff,
                  ]}
                  onPress={() => changePlayerCount(n)}
                  disabled={disabled}
                >
                  <Text
                    style={[
                      styles.segText,
                      rule.playerCount === n && styles.segTextOn,
                      disabled && styles.segTextOff,
                    ]}
                  >
                    {n}人麻雀
                  </Text>
                  {disabled && <Text style={styles.badge}>準備中</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {points.start.toLocaleString()}点持ち / {points.back.toLocaleString()}点返し
          </Text>
          {!SANMA_AVAILABLE && (
            <Text style={styles.warning}>
              3人麻雀は、AIの計算エンジンが対応していないため準備中です
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>長さ</Text>
          <View style={styles.segment}>
            {(["tonpu", "hanchan"] as const).map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.segItem, rule.length === v && styles.segItemOn]}
                onPress={() => setRule({ ...rule, length: v })}
              >
                <Text style={[styles.segText, rule.length === v && styles.segTextOn]}>
                  {v === "tonpu" ? "東風戦" : "東南戦"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ===== 3人麻雀ルール ===== */}
        {isSanma && SANMA_AVAILABLE && (
          <>
            <Text style={styles.section}>3人麻雀ルール</Text>
            <Toggle
              label="北抜きあり"
              note="北を抜きドラとして使う"
              value={rule.kitaNuki}
              onChange={(v) => setRule({ ...rule, kitaNuki: v })}
            />
            <Toggle
              label="ツモ損あり"
              note="不在の家の分を受け取らない"
              value={rule.tsumoLoss}
              onChange={(v) => setRule({ ...rule, tsumoLoss: v })}
            />
          </>
        )}

        {/* ===== 細かいルール ===== */}
        <Text style={styles.section}>細かいルール</Text>

        <Toggle
          label="赤ドラあり"
          value={rule.akaDora}
          onChange={(v) => setRule({ ...rule, akaDora: v })}
        />
        <Toggle
          label="喰いタンあり"
          value={rule.kuitan}
          onChange={(v) => setRule({ ...rule, kuitan: v })}
        />

        <Segment
          label="連荘方式"
          options={RENCHAN_OPTIONS}
          value={rule.renchan}
          onChange={(v) => setRule({ ...rule, renchan: v })}
        />

        <Segment
          label="延長戦"
          options={EXTRA_GAME_OPTIONS}
          value={rule.extraGame}
          onChange={(v) => setRule({ ...rule, extraGame: v })}
        />

        {/* ===== さらに細かいルール（折りたたみ） ===== */}
        <TouchableOpacity style={styles.expander} onPress={() => setShowDetail(!showDetail)}>
          <Text style={styles.expanderText}>
            {showDetail ? "▼" : "▶"} さらに細かいルール
          </Text>
          <Text style={styles.expanderNote}>
            {showDetail ? "" : "喰い替え・切り上げ満貫・同時和了など"}
          </Text>
        </TouchableOpacity>

        {showDetail && (
          <>
            <Toggle
              label="喰い替えあり"
              note="鳴いた面子と同じ牌を切れる（スジ喰い替え）"
              value={rule.kuikae}
              onChange={(v) => setRule({ ...rule, kuikae: v })}
            />
            <Toggle
              label="切り上げ満貫あり"
              note="4翻30符・3翻60符などを満貫として扱う"
              value={rule.kiriage}
              onChange={(v) => setRule({ ...rule, kiriage: v })}
            />
            <Toggle
              label="ツモ番なしリーチあり"
              note="自分のツモが残っていなくてもリーチできる"
              value={rule.tsumobanNashiRiichi}
              onChange={(v) => setRule({ ...rule, tsumobanNashiRiichi: v })}
            />
            <Toggle
              label="ノーテン宣言あり"
              note="流局時、テンパイでもノーテンを選べる"
              value={rule.notenSengen}
              onChange={(v) => setRule({ ...rule, notenSengen: v })}
            />
            <Toggle
              label="途中流局あり"
              note="九種九牌・四風連打・四家立直などで流局"
              value={rule.tochuRyukyoku}
              onChange={(v) => setRule({ ...rule, tochuRyukyoku: v })}
            />

            <Segment
              label="同時和了"
              options={MULTI_RON_OPTIONS}
              value={rule.multiRon}
              onChange={(v) => setRule({ ...rule, multiRon: v })}
            />

            <Toggle
              label="トビ終了あり"
              note="持ち点がマイナスになったら終局"
              value={rule.tobiEnd}
              onChange={(v) => setRule({ ...rule, tobiEnd: v })}
            />
            <Toggle
              label="オーラス止めあり"
              note="トップ目の親が和了れば、連荘せず終局できる"
              value={rule.agariYame}
              onChange={(v) => setRule({ ...rule, agariYame: v })}
            />
          </>
        )}

        {/* ===== 精算ルール ===== */}
        <Text style={styles.section}>精算ルール</Text>

        <Toggle
          label="チップあり"
          value={rule.chip.enabled}
          onChange={(v) => setRule({ ...rule, chip: { ...rule.chip, enabled: v } })}
        />

        {rule.chip.enabled && (
          <View style={styles.card}>
            <Text style={styles.subLabel}>チップが出る条件</Text>

            <View style={styles.switchRowSmall}>
              <Text style={styles.chipItem}>一発</Text>
              <Switch
                value={rule.chip.onIppatsu}
                onValueChange={(v) => setRule({ ...rule, chip: { ...rule.chip, onIppatsu: v } })}
                trackColor={{ true: "#E8B84B", false: "#3A5A4C" }}
              />
            </View>

            <View style={styles.switchRowSmall}>
              <Text style={styles.chipItem}>赤ドラ</Text>
              <Switch
                value={rule.chip.onAka}
                onValueChange={(v) => setRule({ ...rule, chip: { ...rule.chip, onAka: v } })}
                trackColor={{ true: "#E8B84B", false: "#3A5A4C" }}
              />
            </View>

            <View style={styles.switchRowSmall}>
              <Text style={styles.chipItem}>裏ドラ</Text>
              <Switch
                value={rule.chip.onUra}
                onValueChange={(v) => setRule({ ...rule, chip: { ...rule.chip, onUra: v } })}
                trackColor={{ true: "#E8B84B", false: "#3A5A4C" }}
              />
            </View>

            <View style={styles.divider} />

            <Text style={styles.subLabel}>チップ1枚の価値</Text>
            <Text style={styles.hintTight}>
              テンピン（1000点=100円）で1枚100〜500円が相場です
            </Text>

            <View style={styles.valueRow}>
              <TextInput
                style={styles.input}
                value={String(rule.chip.value)}
                onChangeText={(t) => {
                  const n = parseInt(t.replace(/[^0-9]/g, ""), 10);
                  setRule({ ...rule, chip: { ...rule.chip, value: isNaN(n) ? 0 : n } });
                }}
                keyboardType="number-pad"
                maxLength={5}
              />
              <Text style={styles.unit}>点相当</Text>
            </View>

            <View style={styles.presetRow}>
              {CHIP_VALUE_PRESETS.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.presetChip, rule.chip.value === v && styles.presetChipOn]}
                  onPress={() => setRule({ ...rule, chip: { ...rule.chip, value: v } })}
                >
                  <Text style={[styles.presetText, rule.chip.value === v && styles.presetTextOn]}>
                    {v.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.subSection}>ウマ・オカ</Text>
        {presets.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.selectCard, rule.umaOka === p.id && styles.selectCardOn]}
            onPress={() => setRule({ ...rule, umaOka: p.id })}
          >
            <View style={styles.selectRow}>
              <Text style={[styles.selectLabel, rule.umaOka === p.id && styles.selectLabelOn]}>
                {p.label}
              </Text>
              <Text style={styles.selectValue}>
                {p.uma.map((u) => (u > 0 ? `+${u}` : `${u}`)).join(" / ")}
                {p.oka > 0 ? `　オカ +${p.oka}` : "　オカなし"}
              </Text>
            </View>
            <Text style={styles.selectNote}>{p.note}</Text>
          </TouchableOpacity>
        ))}

        {/* ===== レベル ===== */}
        <Text style={styles.section}>あなたの麻雀歴</Text>
        <Text style={styles.sectionSub}>
          推奨する打牌は変わりません。説明のしかたが変わります
        </Text>

        {PLAYER_LEVELS.map((lv) => (
          <TouchableOpacity
            key={lv.id}
            style={[styles.selectCard, level === lv.id && styles.selectCardOn]}
            onPress={() => setLevel(lv.id)}
          >
            <Text style={[styles.selectLabel, level === lv.id && styles.selectLabelOn]}>
              {lv.label}
            </Text>
            <Text style={styles.selectNote}>{lv.description}</Text>
          </TouchableOpacity>
        ))}

        {/* ===== 表示 ===== */}
        <Text style={styles.section}>表示</Text>
        <Toggle
          label="手の進みの ○× を表示する"
          note="切った牌が、有効牌をいちばん多く残す打牌なら ○。打点や安全度は見ていません"
          value={showRating}
          onChange={setShowRating}
        />

        {/* ===== 目的 ===== */}
        <Text style={styles.section}>今回の目的</Text>

        {OBJECTIVES.map((obj) => (
          <TouchableOpacity
            key={obj.id}
            style={[styles.selectCard, objective === obj.id && styles.selectCardOn]}
            onPress={() => setObjective(obj.id)}
          >
            <Text style={[styles.selectLabel, objective === obj.id && styles.selectLabelOn]}>
              {obj.label}
            </Text>
            <Text style={styles.selectNote}>
              {obj.id === "avoidLast" && isSanma
                ? "3着と飛びを避けることを最優先する"
                : obj.description}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => {
            setMatchConfig({ rule, objective, level, showRating });
            router.push("/play");
          }}
        >
          <Text style={styles.startText}>この設定で対局する</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B2B20" },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  back: { color: "#A9C8B8", fontSize: 14 },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "bold", marginTop: 8 },

  body: { paddingHorizontal: 20 },
  section: { color: "#E8B84B", fontSize: 15, fontWeight: "700", marginTop: 24, marginBottom: 4 },
  subSection: { color: "#A9C8B8", fontSize: 13, fontWeight: "600", marginTop: 16, marginBottom: 2 },
  sectionSub: { color: "#7FA893", fontSize: 12, marginBottom: 8 },

  card: { backgroundColor: "#12332A", borderRadius: 12, padding: 14, marginTop: 8 },
  label: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  labelBlock: { flex: 1, paddingRight: 12 },
  hint: { color: "#7FA893", fontSize: 11, marginTop: 8 },
  hintTight: { color: "#7FA893", fontSize: 11, marginTop: 3 },
  warning: { color: "#E8B84B", fontSize: 11, marginTop: 8, lineHeight: 16 },
  subLabel: { color: "#A9C8B8", fontSize: 13, marginBottom: 6 },
  chipItem: { color: "#FFFFFF", fontSize: 14 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchRowSmall: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },

  expander: {
    backgroundColor: "#0F2C23",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F4A3C",
    padding: 14,
    marginTop: 12,
  },
  expanderText: { color: "#A9C8B8", fontSize: 14, fontWeight: "600" },
  expanderNote: { color: "#5F8B76", fontSize: 11, marginTop: 3 },

  divider: { height: 1, backgroundColor: "#1F4A3C", marginVertical: 14 },
  valueRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  input: {
    backgroundColor: "#0B2B20",
    borderWidth: 1,
    borderColor: "#2A5A48",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    width: 110,
    textAlign: "right",
  },
  unit: { color: "#A9C8B8", fontSize: 14 },
  presetRow: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#1A4536",
  },
  presetChipOn: { backgroundColor: "#E8B84B" },
  presetText: { color: "#A9C8B8", fontSize: 12, fontWeight: "600" },
  presetTextOn: { color: "#1A1A1A" },

  segment: { flexDirection: "row", marginTop: 10, gap: 8 },
  segItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#1A4536",
    alignItems: "center",
  },
  segItemOn: { backgroundColor: "#E8B84B" },
  segItemOff: { backgroundColor: "#123024" },
  segText: { color: "#A9C8B8", fontSize: 13, fontWeight: "600", textAlign: "center" },
  segTextOn: { color: "#1A1A1A" },
  segTextOff: { color: "#4A6E5C" },
  badge: { color: "#4A6E5C", fontSize: 9, marginTop: 2 },

  selectCard: {
    backgroundColor: "#12332A",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectCardOn: { borderColor: "#E8B84B", backgroundColor: "#1A4536" },
  selectRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  selectLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  selectLabelOn: { color: "#E8B84B" },
  selectValue: { color: "#A9C8B8", fontSize: 13 },
  selectNote: { color: "#7FA893", fontSize: 12, marginTop: 4 },

  footer: { padding: 20, backgroundColor: "#0B2B20" },
  startButton: {
    backgroundColor: "#E8B84B",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  startText: { color: "#1A1A1A", fontSize: 17, fontWeight: "bold" },
});