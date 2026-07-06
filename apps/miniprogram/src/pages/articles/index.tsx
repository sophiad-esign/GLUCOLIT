import { ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";

import { BrandHeader } from "../../components/brand-header";
import { apiRequest } from "../../lib/api";
import { readLocal, writeLocal } from "../../lib/storage";

type Topic = { slug: string; title: string };
type Article = {
  slug: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
};

export default function ArticlesPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [active, setActive] = useState("");
  const [articles, setArticles] = useState<Article[]>(
    readLocal("article-cache", []),
  );
  const [error, setError] = useState("");

  const load = async (topic = "") => {
    setError("");
    try {
      const result = await apiRequest<{ articles: Article[] }>(
        `/public/articles?limit=20${topic ? `&topic=${topic}` : ""}`,
      );
      setArticles(result.articles);
      writeLocal("article-cache", result.articles);
    } catch (value) {
      setError(value instanceof Error ? value.message : "文章加载失败。");
    }
  };

  useEffect(() => {
    Promise.all([
      apiRequest<{ topics: Topic[] }>("/public/topics").then((value) =>
        setTopics(value.topics),
      ),
      load(),
    ]).catch(() => undefined);
  }, []);

  const select = (slug: string) => {
    setActive(slug);
    void load(slug);
  };

  return (
    <View className="page">
      <BrandHeader />
      <View className="hero">
        <View className="eyebrow">指南</View>
        <View className="hero-title">把知识拆成可执行路线</View>
        <View className="hero-copy">
          聚焦饮食结构、饭后步行、抗阻训练与睡眠节律；先给清单，再看研究来源。
        </View>
      </View>
      <View className="card">
        <Text className="status-pill">Diet</Text>
        <View className="card-title">饮食干预</View>
        <View className="muted">
          聚焦蛋白质、膳食纤维、低 GI 主食与进食顺序。
        </View>
      </View>
      <View className="card">
        <Text className="status-pill">Exercise / Sleep</Text>
        <View className="card-title">运动睡眠</View>
        <View className="muted">
          聚焦饭后步行、有氧、抗阻训练、睡眠节律和恢复。
        </View>
      </View>
      <ScrollView className="chips" scrollX>
        <Text
          className={`chip ${active === "" ? "active" : ""}`}
          onClick={() => select("")}
        >
          全部
        </Text>
        {topics.map((topic) => (
          <Text
            className={`chip ${active === topic.slug ? "active" : ""}`}
            key={topic.slug}
            onClick={() => select(topic.slug)}
          >
            {topic.title}
          </Text>
        ))}
      </ScrollView>
      {error && (
        <View className="notice error">{error} 当前显示上次缓存内容。</View>
      )}
      {articles.map((article) => (
        <View
          className="card"
          key={article.slug}
          onClick={() =>
            Taro.navigateTo({
              url: `/pages/article/index?slug=${encodeURIComponent(article.slug)}`,
            })
          }
        >
          <View className="card-title">{article.title}</View>
          <View className="muted">{article.summary}</View>
          <View className="muted">
            {article.source} · {article.publishedAt}
          </View>
        </View>
      ))}
      {!articles.length && (
        <View className="card muted">这个主题正在积累文章，请稍后再来。</View>
      )}
    </View>
  );
}
