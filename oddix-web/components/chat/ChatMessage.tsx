"use client";

type Props = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div style={{ ...styles.row, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={isUser ? styles.userBubble : styles.aiBubble}>
        {!isUser && <div style={styles.aiLabel}>🤖 Oddix IA</div>}
        <div style={styles.content}>{content}</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    marginBottom: 16,
  },
  userBubble: {
    maxWidth: "78%",
    background: "#facc15",
    color: "#050505",
    borderRadius: "18px 18px 4px 18px",
    padding: "14px 16px",
    fontWeight: 800,
    whiteSpace: "pre-wrap",
  },
  aiBubble: {
    maxWidth: "86%",
    background: "rgba(255,255,255,.055)",
    border: "1px solid rgba(250,204,21,.16)",
    color: "#fff",
    borderRadius: "18px 18px 18px 4px",
    padding: "14px 16px",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  },
  aiLabel: {
    color: "#facc15",
    fontWeight: 1000,
    marginBottom: 8,
    fontSize: 13,
  },
  content: {
    fontSize: 15,
  },
};