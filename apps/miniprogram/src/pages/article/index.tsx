import { Button, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { useEffect, useState } from "react";

import { apiRequest } from "../../lib/api";

type Article = {
  title: string;
  body: string;
  source: string;
  authors: string;
  publishedAt: string;
  referenceLinks: { label: string; href: string }[];
};

export default function ArticlePage() {
  const { params } = useRouter();
  const [article, setArticle] = useState<Article>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!params.slug) return;
    apiRequest<{ article: Article }>(
      `/public/articles/${encodeURIComponent(params.slug)}`,
    )
      .then((value) => setArticle(value.article))
      .catch((value) =>
        setError(value instanceof Error ? value.message : "文章加载失败。"),
      );
  }, [params.slug]);
  if (error)
    return (
      <View className="page">
        <View className="notice error">{error}</View>
      </View>
    );
  if (!article) return <View className="page muted">正在加载…</View>;
  return (
    <View className="page">
      <View className="card">
        <View className="hero-title">{article.title}</View>
        <View className="muted">
          {article.source} · {article.publishedAt}
        </View>
        <View className="markdown">{article.body}</View>
      </View>
      {article.referenceLinks.map((link) => (
        <Button
          className="button ghost"
          key={link.href}
          onClick={() => Taro.setClipboardData({ data: link.href })}
        >
          复制{link.label}链接
        </Button>
      ))}
      <View className="notice">文章仅用于健康科普，不构成个体化医疗建议。</View>
    </View>
  );
}
