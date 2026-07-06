import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { BrandHeader } from "../../components/brand-header";
import { readLocal } from "../../lib/storage";

type LifestyleRecord = {
  sleepHours: number;
  postMealMinutes: number;
  aerobicMinutes: number;
  mealRecords?: number;
  fastingGlucose?: number;
  postMealGlucose?: number;
};

export default function HomePage() {
  const records = readLocal<LifestyleRecord[]>("lifestyle-records", []);
  const latest = records[records.length - 1];
  const sleep = latest?.sleepHours ?? 7.2;
  const movement =
    (latest?.postMealMinutes ?? 15) + (latest?.aerobicMinutes ?? 15);
  const meals = latest?.mealRecords ?? 0;
  const peak = latest?.postMealGlucose;

  return (
    <View className="page">
      <BrandHeader />
      <View className="hero">
        <View className="row">
          <View>
            <View className="eyebrow">今日健康概览</View>
            <View className="hero-title">早上好，今天稳一点</View>
          </View>
          <View>
            <Text className="status-pill">需留意</Text>
          </View>
        </View>
        <View className="hero-copy">
          不需要重启完整计划。今天先完成一件最重要的小事。
        </View>
        <View className="score-block">
          <View className="score-ring">
            <View className="score-inner">
              <Text className="score-number">82</Text>
              <Text className="score-label">稳住节奏</Text>
            </View>
          </View>
          <View>
            <View className="daily-stat">◉ 饮食 {meals}/3 记录</View>
            <View className="daily-stat">◔ 睡眠 {sleep} 小时</View>
            <View className="daily-stat">⌁ 运动 {movement} 分钟</View>
          </View>
        </View>
        <View className="trend-card">
          <View className="trend-title">
            <Text>近 24 小时血糖趋势</Text>
            <Text>mmol/L</Text>
          </View>
          <View className="trend-plot">
            <View
              className="trend-line"
              style="left:5%;top:112px;width:25%;transform:rotate(-4deg)"
            />
            <View
              className="trend-line"
              style="left:29%;top:106px;width:25%;transform:rotate(-28deg)"
            />
            <View
              className="trend-line"
              style="left:52%;top:53px;width:20%;transform:rotate(27deg)"
            />
            <View
              className="trend-line"
              style="left:69%;top:87px;width:25%;transform:rotate(-8deg)"
            />
            <View className="trend-dot" style="left:4%;top:101px" />
            <View className="trend-dot" style="left:28%;top:95px" />
            <View className="trend-dot warn" style="left:51%;top:42px" />
            <View className="trend-dot" style="left:68%;top:76px" />
            <View className="trend-dot" style="left:92%;top:60px" />
          </View>
          <View className="trend-labels">
            <Text>00:00</Text>
            <Text>06:00</Text>
            <Text>12:00</Text>
            <Text>18:00</Text>
            <Text>24:00</Text>
          </View>
        </View>
        <View className="mini-grid">
          <View className="mini-card">
            <Text>餐后峰值</Text>
            <View className="mini-value">{peak ?? "待录入"}</View>
          </View>
          <View className="mini-card">
            <Text>睡眠</Text>
            <View className="mini-value">{sleep}h</View>
          </View>
          <View className="mini-card">
            <Text>未打卡</Text>
            <View className="mini-value">1</View>
          </View>
        </View>
      </View>
      <View className="notice success">
        建议：餐后 15–30 分钟内散步 15 分钟，帮助维持更平稳的餐后节奏。
      </View>
      <View className="row">
        <Button
          className="button"
          onClick={() => Taro.switchTab({ url: "/pages/tools/index" })}
        >
          拍一餐
        </Button>
        <Button
          className="button ghost"
          onClick={() => Taro.switchTab({ url: "/pages/records/index" })}
        >
          今日行动
        </Button>
      </View>
      <Button
        className="button ghost"
        onClick={() => Taro.navigateTo({ url: "/pages/companion/index" })}
      >
        难受时，让陪伴助手接住我
      </Button>
      <View className="notice">
        本产品提供健康信息与生活方式记录，不构成医疗诊断或治疗建议，请遵医嘱。
      </View>
    </View>
  );
}
