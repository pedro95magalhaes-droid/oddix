"use client";

import { useEffect, useRef, useState } from "react";
import ChatSidebar from "../../components/chat/ChatSidebar";
import ChatMessage from "../../components/chat/ChatMessage";
import ChatInput from "../../components/chat/ChatInput";
import QuickActions from "../../components/chat/QuickActions";
import { sendChatMessage } from "../../services/chat.service";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: any;
};

const WELCOME = `🤖 Olá, Pedro!

Eu sou a Oddix IA.

Sou especialista em futebol e apostas.

Posso:

⚽ Analisar jogos
🎯 Criar aposta simples
🔥 Montar múltiplas
👤 Criar Player Props
📈 Analisar jogos ao vivo
🏆 Encontrar oportunidades de valor
🎮 Futebol Virtual

O que você quer apostar hoje?`;

export default function ChatPage() {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME,
    },
  ]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function newChat() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: WELCOME,
      },
    ]);
  }

  async function handleSend(text: string) {
  const userMessage: Message = {
    id: `user-${Date.now()}`,
    role: "user",
    content: text,
  };

  const nextMessages = [...messages, userMessage];

  setMessages(nextMessages);
  setLoading(true);

  try {
    const chatHistory = nextMessages.map((item) => ({
      role: item.role,
      content: item.content,
      data: item.data,
    }));

    const response = await sendChatMessage(text, "balanced", chatHistory);

    const aiMessage: Message = {
      id: `ai-${Date.now()}`,
      role: "assistant",
      content:
        response?.answer ||
        "Não consegui gerar uma resposta agora. Tente novamente.",
      data: response?.data,
    };

    setMessages((current) => [...current, aiMessage]);
  } catch (error: any) {
    setMessages((current) => [
      ...current,
      {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "⚠️ Não consegui conectar com a Oddix IA agora. Verifique se o backend está online.",
      },
    ]);
  } finally {
    setLoading(false);
  }
}

  return (
    <main style={styles.page}>
      <ChatSidebar onNewChat={newChat} />

      <section style={styles.chat}>
        <header style={styles.header}>
          <div>
            <span style={styles.kicker}>ODDIX CHAT IA</span>
            <h1 style={styles.title}>Seu assistente de futebol e apostas</h1>
          </div>

          <div style={styles.status}>
            <span style={styles.dot} />
            IA online
          </div>
        </header>

        <div style={styles.body}>
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
            />
          ))}

          {loading && (
            <div style={styles.typing}>
              🤖 Oddix IA está analisando mercados, odds e estatísticas...
            </div>
          )}

          {messages.length === 1 && <QuickActions onSelect={handleSend} />}

          <div ref={bottomRef} />
        </div>

        <ChatInput disabled={loading} onSend={handleSend} />
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    background:
      "radial-gradient(circle at 70% 0%, rgba(250,204,21,.14), transparent 30%), #030303",
    color: "#fff",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  chat: {
    flex: 1,
    height: "100dvh",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  header: {
    padding: "18px 24px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    background: "rgba(5,5,5,.80)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  kicker: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: 1,
  },
  title: {
    margin: "4px 0 0",
    fontSize: "clamp(20px, 3vw, 32px)",
    letterSpacing: -1,
  },
  status: {
    border: "1px solid rgba(34,197,94,.25)",
    color: "#86efac",
    background: "rgba(34,197,94,.08)",
    borderRadius: 999,
    padding: "9px 12px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#22c55e",
  },
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    maxWidth: 1100,
    width: "100%",
    margin: "0 auto",
  },
  typing: {
    color: "#facc15",
    fontWeight: 900,
    padding: 14,
    border: "1px solid rgba(250,204,21,.18)",
    borderRadius: 16,
    background: "rgba(250,204,21,.06)",
    marginBottom: 16,
  },
};