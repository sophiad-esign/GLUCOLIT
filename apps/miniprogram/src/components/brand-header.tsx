import { Text, View } from "@tarojs/components";

export function BrandHeader({ eyebrow }: { eyebrow?: string }) {
  return (
    <View className="brand-header">
      <View>
        <View className="brand-kicker">
          {eyebrow || "AI METABOLIC COMPANION"}
        </View>
        <View className="brand-lockup">
          <View className="brand-mark" />
          <Text className="brand-name">GLUCOLIT</Text>
        </View>
      </View>
      <View className="brand-switch">⇄ 切换</View>
    </View>
  );
}
