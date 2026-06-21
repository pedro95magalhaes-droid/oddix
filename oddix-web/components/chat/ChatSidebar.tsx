"use client";

import Link from "next/link";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  onNewChat: () => void;
};

export default function ChatSidebar({ collapsed, onToggle, onNewChat }: Props) {
  if (collapsed) {
    return (
      <aside style={styles.miniSidebar}>
        <button onClick={onToggle} style={styles.iconButton} title="Abrir histórico">
          ☰
        </button>

        <div style={styles.miniLogo}>O</div>

        <button onClick={onNewChat} style={styles.iconButton} title="Nova conversa">
          ＋
        </button>

        <Link href="/dashboard" style={styles.iconLink} title="Dashboard">
          ⚙️
        </Link>
      </aside>
    );
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.topRow}>
        <div>
          <div style={styles.logo}>ODDIX IA</div>
          <p style={styles.subtitle}>Histórico e atalhos</p>
        </div>

        <button onClick={onToggle} style={styles.closeButton} title="Minimizar">
          ✕
        </button>
      </div>

      <button onClick={onNewChat} style={styles.newButton}>
        ➕ Nova conversa
      </button>

      <div style={styles.section}>
        <span style={styles.sectionTitle}>Histórico</span>

        <button style={styles.item}>🔥 Múltipla segura</button>
        <button style={styles.item}>🎯 Aposta simples</button>
        <button style={styles.item}>👤 Player Props</button>
        <button style={styles.item}>📈 Jogos ao vivo</button>
      </div>

      <div style={styles.section}>
        <span style={styles.sectionTitle}>Atalhos</span>

        <div style={styles.item}>🏆 Jogos de hoje</div>
        <div style={styles.item}>🎮 Futebol virtual</div>
        <div style={styles.item}>💰 Gestão de banca</div>
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
  miniSidebar: {
    width: 62,
    minWidth: 62,
    height: "100dvh",
    background: "linear-gradient(180deg,#050505,#101010)",
    borderRight: "1px solid rgba(250,204,21,.16)",
    padding: "14px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    color: "#fff",
  },
  miniLogo: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: "#facc15",
    color: "#050505",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    fontSize: 20,
    marginBottom: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(250,204,21,.22)",
    background: "rgba(250,204,21,.08)",
    color: "#facc15",
    fontWeight: 1000,
    cursor: "pointer",
  },
  iconLink: {
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.04)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    textDecoration: "none",
    marginTop: "auto",
  },
  sidebar: {
    width: 260,
    minWidth: 260,
    height: "100dvh",
    background: "linear-gradient(180deg,#050505,#111)",
    borderRight: "1px solid rgba(250,204,21,.18)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    color: "#fff",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  logo: {
    fontSize: 23,
    fontWeight: 1000,
    color: "#facc15",
    letterSpacing: -1,
  },
  subtitle: {
    margin: "4px 0 0",
    color: "rgba(255,255,255,.58)",
    fontSize: 12,
    fontWeight: 800,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.05)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 1000,
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
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: 1000,
    letterSpacing: 1,
  },
  item: {
    padding: "11px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,.045)",
    border: "1px solid rgba(255,255,255,.06)",
    color: "#fff",
    fontWeight: 800,
    textAlign: "left",
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