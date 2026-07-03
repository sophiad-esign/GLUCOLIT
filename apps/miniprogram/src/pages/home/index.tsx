import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

const actions = [
  {
    title: "拍一餐，马上优化",
    copy: "识别餐盘结构，获得更适合糖前期的下一餐建议。",
    tab: 2,
  },
  {
    title: "看懂 OGTT 报告",
    copy: "识别后由你核对数值，再按确定性规则完成分层。",
    tab: 2,
  },
  {
    title: "记录今天的恢复",
    copy: "把睡眠、饭后活动和训练变成可观察的七日趋势。",
    tab: 3,
  },
  {
    title: "难受时有人接住",
    copy: "不批评、不说教，把目标缩小到今天能做的一步。",
    tab: 4,
  },
];

export default function HomePage() {
  return (
    <View className="page">
      <View className="hero">
        <View className="hero-title">GLUCOLIT</View>
        <View className="hero-copy">
          用可信科普和可执行的小行动，陪你管理糖尿病前期。
        </View>
      </View>
      <View className="notice">
        本工具用于健康教育与生活方式参考，不替代医生诊断、处方或紧急医疗服务。
      </View>
      {actions.map((action) => (
        <View className="card" key={action.title}>
          <View className="card-title">{action.title}</View>
          <Text className="muted">{action.copy}</Text>
          <Button
            className="button ghost"
            onClick={() =>
              Taro.switchTab({
                url: `/pages/${["home", "articles", "tools", "records", "companion"][action.tab]}/index`,
              })
            }
          >
            现在开始
          </Button>
        </View>
      ))}
      <View className="card">
        <View className="card-title">CGM 怎么看？</View>
        <Text className="muted">
          MVP 暂不连接设备。你可以先在科普板块理解餐后峰值、回落时间和数据局限。
        </Text>
        <Button
          className="button secondary"
          onClick={() => Taro.switchTab({ url: "/pages/articles/index" })}
        >
          查看科普
        </Button>
      </View>
    </View>
  );
}
