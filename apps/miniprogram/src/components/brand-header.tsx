import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

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
      <View
        className="brand-switch"
        onClick={() => Taro.navigateTo({ url: "/pages/profile/index" })}
      >
        ⇄ 切换
      </View>
    </View>
  );
}
