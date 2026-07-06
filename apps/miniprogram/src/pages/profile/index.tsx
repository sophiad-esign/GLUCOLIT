import { Button, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { BrandHeader } from "../../components/brand-header";
import { readLocal } from "../../lib/storage";

const storageKeys = [
  "lifestyle-records",
  "daily-core-action",
  "article-cache",
  "companion-messages",
];

export default function ProfilePage() {
  const recordCount = readLocal<unknown[]>("lifestyle-records", []).length;

  const showPolicy = () =>
    Taro.showModal({
      title: "隐私与数据说明",
      content:
        "健康数据仅按完成当前功能所需进行处理。本机记录可随时删除；上传的原始报告、餐食与食品标签图片不作长期保存。AI 结果仅用于健康教育和生活方式参考。",
      showCancel: false,
      confirmText: "我知道了",
    });

  const clearData = async () => {
    const result = await Taro.showModal({
      title: "删除本机数据？",
      content:
        "这会删除生活方式记录、行动打卡、文章缓存和陪伴对话，且无法恢复。",
      confirmText: "确认删除",
      confirmColor: "#b42318",
    });
    if (!result.confirm) return;
    storageKeys.forEach((key) => Taro.removeStorageSync(`glucolit:v1:${key}`));
    await Taro.showToast({ title: "本机数据已删除", icon: "success" });
  };

  return (
    <View className="page">
      <BrandHeader eyebrow="MY HEALTH PROFILE" />
      <View className="hero">
        <View className="eyebrow">我的</View>
        <View className="hero-title">健康档案与数据授权</View>
        <View className="hero-copy">
          你决定记录什么，也可以随时删除本机保存的数据。
        </View>
      </View>
      <View className="card">
        <View className="card-title">档案概览</View>
        <View className="action-step">
          <View className="action-label">生活方式记录</View>
          已保存 {recordCount} 天
        </View>
        <View className="action-step">
          <View className="action-label">报告与照片</View>
          原始上传图片不作长期保存
        </View>
      </View>
      <View className="card">
        <View className="card-title">隐私与授权</View>
        <Button className="button ghost" onClick={showPolicy}>
          查看隐私说明
        </Button>
        <Button className="button ghost" onClick={clearData}>
          删除本机数据
        </Button>
      </View>
      <View className="notice">
        本产品提供健康信息与生活方式记录，不构成医疗诊断或治疗建议，请遵医嘱。
      </View>
    </View>
  );
}
