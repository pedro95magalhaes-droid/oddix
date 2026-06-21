"use client";

import Link from "next/link";

type Props = {
  onNewChat: () => void;
};

export default function ChatSidebar({ onNewChat }: Props) {
  return (
    <aside style={styles.sidebar}>
      <div>
        <div style={styles.logo}>ODDIX IA</div>
        <p style={styles.subtitle}>Chat especialista em futebol</p>
      </div>

      <button onClick={onNewChat} style={styles.newButton}>
        ➕ Nova conversa
      </button>

      <div style={styles.section}>
        <span style={styles.sectionTitle}>Atalhos</span>

        <div style={styles.item}>🔥 Múltipla de hoje</div>
        <div style={styles.item}>⚽ Analisar jogo</div>
        <div style={styles.item}>👤 Player Props</div>
        <div style={styles.item}>📈 Jogos ao vivo</div>
        <div style={styles.item}>🎮 Futebol virtual</div>
        <div style={styles.item}>🏆 Top Picks</div>
      </div>

      <div style={styles.bottom}>
        <Link href="/dashboard" style={styles.link}>
          ⚙️ Dashboard
        </Link>

        <Link href="/virtual" style={styles.link}>
          🎮 Virtual
        </Link>

        <Link href="/plans" style={styles.vip}>
          👑 Seja VIP
        </Link>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 280,
    minWidth: 280,
    height: "100dvh",
    background: "linear-gradient(180deg,#050505,#111)",
    borderRight: "1px solid rgba(250,204,21,.18)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 18,
    color: "#fff",
  },
  logo: {
    fontSize: 24,
    fontWeight: 1000,
    color: "#facc15",
    letterSpacing: -1,
  },
  subtitle: {
    margin: "4px 0 0",
    color: "rgba(255,255,255,.58)",
    fontSize: 13,
    fontWeight: 700,
  },
  newButton: {
    border: "1px solid rgba(250,204,21,.35)",
    background: "rgba(250,204,21,.12)",
    color: "#facc15",
    borderRadius: 14,
    padding: "13px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    textAlign: "left",
  },
  section: {
    display: "grid",
    gap: 8,
  },
  sectionTitle: {
    color: "rgba(255,255,255,.45)",
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: 900,
    letterSpacing: 1,
  },
  item: {
    padding: "12px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,.045)",
    border: "1px solid rgba(255,255,255,.06)",
    fontWeight: 800,
  },
  bottom: {
    marginTop: "auto",
    display: "grid",
    gap: 8,
  },
  link: {
    color: "rgba(255,255,255,.78)",
    textDecoration: "none",
    padding: "11px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,.04)",
    fontWeight: 800,
  },
  vip: {
    color: "#050505",
    background: "#facc15",
    textDecoration: "none",
    padding: "12px",
    borderRadius: 12,
    fontWeight: 1000,
    textAlign: "center",
  },
};