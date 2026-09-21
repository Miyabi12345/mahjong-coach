/**
 * データの取り扱いへの同意画面（Phase 2。2026-09-22）
 *
 * 初めてコーチに質問するとき（🎤を含む）に開く。ホーム画面の「データの取り扱い」からも開ける（取り消しもここ）。
 * 外国への提供の同意は、ほかの確認と分けてチェックしてもらう（mahjong-api docs/リリース準備 2-5）。
 * 文面は src/consent/consent.ts（下書き）。
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { clearConsent, CONSENT_TEXT as T, getConsent, saveConsent } from "../consent/consent";

export default function ConsentScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState(getConsent());
  const [readSent, setReadSent] = useState(false);
  const [foreign, setForeign] = useState(false);
  const [age, setAge] = useState(false);
  const all = readSent && foreign && age;

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{T.title}</Text>
        {current && (
          <View style={styles.status}>
            <Text style={styles.statusText}>同意済み（{new Date(current.at).toLocaleString()}）</Text>
            <TouchableOpacity
              onPress={() => {
                clearConsent();
                setCurrent(null);
              }}
            >
              <Text style={styles.link}>同意を取り消す</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.p}>{T.lead}</Text>
        {T.sent.map((x) => (
          <Text key={x} style={styles.li}>・{x}</Text>
        ))}
        <View style={{ height: 8 }} />
        {T.purpose.map((x) => (
          <Text key={x} style={styles.li}>・{x}</Text>
        ))}
        {!current && (
          <Check checked={readSent} onPress={() => setReadSent(!readSent)} label="送る情報と目的を確認しました" />
        )}

        {/* 外国への提供は、ほかの確認と分けて、枠で目立たせる */}
        <View style={styles.foreignBox}>
          <Text style={styles.h2}>{T.foreign.heading}</Text>
          <Text style={styles.p}>{T.foreign.country}</Text>
          <Text style={styles.p}>{T.foreign.system}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(T.foreign.systemLink)}>
            <Text style={styles.link}>個人情報保護委員会「外国における個人情報の保護に関する制度等の調査（アメリカ）」</Text>
          </TouchableOpacity>
          <Text style={[styles.p, { marginTop: 8 }]}>OpenAI の保護措置：</Text>
          {T.foreign.measures.map((x) => (
            <Text key={x} style={styles.li}>・{x}</Text>
          ))}
          <TouchableOpacity onPress={() => Linking.openURL(T.foreign.measuresLink)}>
            <Text style={styles.link}>OpenAI の説明（英語）</Text>
          </TouchableOpacity>
          {!current && (
            <Check
              checked={foreign}
              onPress={() => setForeign(!foreign)}
              label="アメリカ合衆国の OpenAI に上の情報を送ることに同意します"
              strong
            />
          )}
        </View>

        {!current && <Check checked={age} onPress={() => setAge(!age)} label={T.age} />}
        <Text style={styles.note}>{T.note}</Text>
        <Text style={styles.note}>プライバシーポリシー：準備中</Text>

        {!current ? (
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.agree, !all && styles.disabled]}
              disabled={!all}
              onPress={() => {
                saveConsent();
                back();
              }}
            >
              <Text style={styles.agreeText}>同意してコーチを使う</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.decline} onPress={back}>
              <Text style={styles.declineText}>同意しない（コーチを使わずに打つ）</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.decline} onPress={back}>
            <Text style={styles.declineText}>戻る</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Check({ checked, onPress, label, strong }: { checked: boolean; onPress: () => void; label: string; strong?: boolean }) {
  return (
    <TouchableOpacity style={styles.check} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked && <Text style={styles.tick}>✓</Text>}</View>
      <Text style={[styles.checkLabel, strong && styles.checkStrong]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B2B20" },
  body: { padding: 16, paddingBottom: 40, maxWidth: 640, width: "100%", alignSelf: "center" },
  title: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginBottom: 12 },
  status: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  statusText: { color: "#4CAF7D", fontSize: 13, fontWeight: "700" },
  p: { color: "#DCE9E2", fontSize: 14, lineHeight: 21 },
  li: { color: "#DCE9E2", fontSize: 13, lineHeight: 20, marginLeft: 4 },
  h2: { color: "#E8B84B", fontSize: 15, fontWeight: "700", marginBottom: 6 },
  link: { color: "#7FC8F8", fontSize: 13, textDecorationLine: "underline", marginTop: 4 },
  foreignBox: { borderWidth: 2, borderColor: "#E8B84B", borderRadius: 8, padding: 12, marginTop: 16 },
  check: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  box: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: "#A8C5B5", alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: "#4CAF7D", borderColor: "#4CAF7D" },
  tick: { color: "#FFFFFF", fontWeight: "700" },
  checkLabel: { color: "#FFFFFF", fontSize: 14, flex: 1 },
  checkStrong: { fontWeight: "700" },
  note: { color: "#A8C5B5", fontSize: 12, marginTop: 12, lineHeight: 18 },
  buttons: { gap: 10, marginTop: 20 },
  agree: { backgroundColor: "#E8B84B", borderRadius: 22, paddingVertical: 12, alignItems: "center" },
  agreeText: { color: "#1A1A1A", fontSize: 15, fontWeight: "700" },
  disabled: { backgroundColor: "#5A6F62" },
  decline: { borderRadius: 22, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#5A7A6B", marginTop: 10 },
  declineText: { color: "#DCE9E2", fontSize: 14 },
});
