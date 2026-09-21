/**
 * 麻雀牌の絵（2026-09-21。みやびさん「文字の牌が見にくい」）
 *
 * 画像：FluffyStuff/riichi-mahjong-tiles（Export/Regular）
 *   https://github.com/FluffyStuff/riichi-mahjong-tiles
 *   ライセンスは CC0（パブリックドメイン）。商用・改変・再配布が自由で、クレジット表記も要らない
 *
 * 牌の絵は「牌の地（Front.png）」の上に「柄（Man1.png など。背景は透明）」を重ねて作る。
 * 牌はアプリ表記："1m"〜"9m"・"0m"（赤5）・"1p"…・"1s"…・東南西北白發中
 */
import { Image, StyleSheet, View } from "react-native";

const FACES: Record<string, number> = {
  "1m": require("../../assets/tiles/Man1.png"),
  "2m": require("../../assets/tiles/Man2.png"),
  "3m": require("../../assets/tiles/Man3.png"),
  "4m": require("../../assets/tiles/Man4.png"),
  "5m": require("../../assets/tiles/Man5.png"),
  "6m": require("../../assets/tiles/Man6.png"),
  "7m": require("../../assets/tiles/Man7.png"),
  "8m": require("../../assets/tiles/Man8.png"),
  "9m": require("../../assets/tiles/Man9.png"),
  "0m": require("../../assets/tiles/Man5-Dora.png"),
  "1p": require("../../assets/tiles/Pin1.png"),
  "2p": require("../../assets/tiles/Pin2.png"),
  "3p": require("../../assets/tiles/Pin3.png"),
  "4p": require("../../assets/tiles/Pin4.png"),
  "5p": require("../../assets/tiles/Pin5.png"),
  "6p": require("../../assets/tiles/Pin6.png"),
  "7p": require("../../assets/tiles/Pin7.png"),
  "8p": require("../../assets/tiles/Pin8.png"),
  "9p": require("../../assets/tiles/Pin9.png"),
  "0p": require("../../assets/tiles/Pin5-Dora.png"),
  "1s": require("../../assets/tiles/Sou1.png"),
  "2s": require("../../assets/tiles/Sou2.png"),
  "3s": require("../../assets/tiles/Sou3.png"),
  "4s": require("../../assets/tiles/Sou4.png"),
  "5s": require("../../assets/tiles/Sou5.png"),
  "6s": require("../../assets/tiles/Sou6.png"),
  "7s": require("../../assets/tiles/Sou7.png"),
  "8s": require("../../assets/tiles/Sou8.png"),
  "9s": require("../../assets/tiles/Sou9.png"),
  "0s": require("../../assets/tiles/Sou5-Dora.png"),
  東: require("../../assets/tiles/Ton.png"),
  南: require("../../assets/tiles/Nan.png"),
  西: require("../../assets/tiles/Shaa.png"),
  北: require("../../assets/tiles/Pei.png"),
  白: require("../../assets/tiles/Haku.png"),
  發: require("../../assets/tiles/Hatsu.png"),
  中: require("../../assets/tiles/Chun.png"),
};
const FRONT = require("../../assets/tiles/Front.png");
const BACK = require("../../assets/tiles/Back.png");

/** 牌の大きさ（幅）。高さは画像と同じ 3:4 */
export const TILE_WIDTH = { hand: 38, meld: 30, river: 24, small: 20 } as const;
export type TileSize = keyof typeof TILE_WIDTH;

export function tileHeight(size: TileSize) {
  return Math.round((TILE_WIDTH[size] * 4) / 3);
}

/** 牌1枚の絵。枠・選択・薄く表示などは、外側の View で付ける */
/** width を渡すと、その幅で描く（盤面の大きさに合わせるとき） */
export function TileFace({ tile, size, back, width }: { tile: string; size: TileSize; back?: boolean; width?: number }) {
  const w = width ?? TILE_WIDTH[size];
  const h = Math.round((w * 4) / 3);
  const face = FACES[tile];
  return (
    // Front.png は光沢と影だけの半透明の絵なので、牌の地の色は自分で塗る
    <View style={{ width: w, height: h, backgroundColor: back ? "#E8A33D" : "#F7F3EA", borderRadius: w * 0.12, overflow: "hidden" }}>
      <Image source={back ? BACK : FRONT} style={StyleSheet.absoluteFill} resizeMode="stretch" />
      {!back && face != null && (
        // 柄は少し内側に置く（牌の縁を残す）
        <Image
          source={face}
          style={{ position: "absolute", left: w * 0.08, top: h * 0.07, width: w * 0.84, height: h * 0.86 }}
          resizeMode="contain"
        />
      )}
    </View>
  );
}
