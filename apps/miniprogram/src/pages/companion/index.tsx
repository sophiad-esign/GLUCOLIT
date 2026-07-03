import { Button, Textarea, View } from "@tarojs/components";
import { useState } from "react";

import { apiRequest } from "../../lib/api";
import { readLocal, writeLocal } from "../../lib/storage";

type Message = { role: "user" | "assistant"; content: string };
type Reply = {
  reply: string;
  nextAction: string;
  affirmation: string;
  crisis?: boolean;
};
const safeText = (value: string) => value.trim();

export default function CompanionPage() {
  const [messages, setMessages] = useState<Message[]>(
    readLocal("companion-messages", []),
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (mode: "chat" | "sos" | "restart" | "weekly" = "chat") => {
    if (busy || (!text.trim() && mode === "chat")) return;
    setBusy(true);
    setError("");
    const prompts = {
      chat: "",
      sos: "我现在很难受，快坚持不住了",
      restart: "我偏离计划了，想重新开始",
      weekly: "帮我复盘这一周",
    } as const;
    const message = text.trim() || prompts[mode];
    const user: Message = { role: "user", content: message };
    const pending = [...messages, user].slice(-20);
    setMessages(pending);
    setText("");
    try {
      const result = await apiRequest<Reply>("/ai/companion", {
        method: "POST",
        retry: false,
        data: {
          mode,
          message,
          dayNumber: 1,
          checkins: [],
          recentMessages: messages.slice(-8),
        },
      });
      const content = [
        safeText(result.reply),
        result.nextAction ? `现在可以做：${safeText(result.nextAction)}` : "",
        result.affirmation ? safeText(result.affirmation) : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const next = [...pending, { role: "assistant" as const, content }].slice(
        -20,
      );
      setMessages(next);
      writeLocal("companion-messages", next);
    } catch (value) {
      setError(value instanceof Error ? value.message : "回复暂时不可用。");
      writeLocal("companion-messages", pending);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View className="page">
      <View className="hero">
        <View className="hero-title">难受时有人接住</View>
        <View className="hero-copy">
          不用组织语言。偏离不等于失败，下一步可以很小。
        </View>
      </View>
      <Button className="button" onClick={() => send("sos")}>
        我快坚持不住了
      </Button>
      <View className="row">
        <Button className="button ghost" onClick={() => send("restart")}>
          重新开始
        </Button>
        <Button className="button ghost" onClick={() => send("weekly")}>
          每周复盘
        </Button>
      </View>
      <View className="card">
        {messages.map((message, index) => (
          <View
            className={message.role === "user" ? "notice" : "notice success"}
            key={`${index}-${message.content.slice(0, 12)}`}
          >
            {message.content}
          </View>
        ))}
        {!messages.length && (
          <View className="muted">你可以说说此刻最难的是什么。</View>
        )}
      </View>
      <Textarea
        className="textarea"
        maxlength={1200}
        value={text}
        onInput={(event) => setText(event.detail.value)}
        placeholder="不用组织语言，想到什么就说什么。"
      />
      <Button
        loading={busy}
        disabled={busy}
        className="button secondary"
        onClick={() => send("chat")}
      >
        发送
      </Button>
      {error && (
        <View className="notice error">
          {error} 先喝几口水、离开诱因三分钟，稍后再试。
        </View>
      )}
      <View className="notice">
        若你可能伤害自己或无法保证安全，请立即联系身边可信任的人和当地急救服务；中国大陆可拨打
        120 或 110。不要只依赖 AI。
      </View>
    </View>
  );
}
