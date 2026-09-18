import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>麻雀AIコーチ</Text>
        <Text style={styles.subtitle}>友達と打つ前に、AIと練習</Text>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push("/game")}
        >
          <Text style={styles.primaryButtonText}>対局をはじめる</Text>
          <Text style={styles.primaryButtonSub}>4人麻雀 / 東風 / 赤あり</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push("/settings")}
        >
          <Text style={styles.secondaryButtonText}>対局設定</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>成績・傾向</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>MVP開発中</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F3D2E",
    paddingHorizontal: 24,
  },
  header: {
    marginTop: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 15,
    color: "#A9C8B8",
    marginTop: 8,
  },
  menu: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  primaryButton: {
    backgroundColor: "#E8B84B",
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  primaryButtonSub: {
    fontSize: 13,
    color: "#5A4A20",
    marginTop: 4,
  },
  secondaryButton: {
    backgroundColor: "#1A5C46",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  footer: {
    textAlign: "center",
    color: "#6E8F7E",
    fontSize: 12,
    marginBottom: 16,
  },
});