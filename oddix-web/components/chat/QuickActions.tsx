"use client";

type Props = {
  onSelect: (text: string) => void;
};

const ACTIONS = [
  "🎯 Quero uma aposta simples segura",
  "🔥 Monte uma múltipla segura para hoje",
  "🚀 Monte uma múltipla agressiva",
  "👤 Quero Player Props",
  "📈 Analisar jogos ao vivo",
  "🎮 Top Pick Virtual",
  "🏆 Mostrar Top Picks",
];

export default function QuickActions({ onSelect }: Props) {
  return (
    <div style={styles.wrap}>
      {ACTIONS.map((action) => (
        <button key={action} onClick={() => onSelect(action)} style={styles.button}>
          {action}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  button: {
    border: "1px solid rgba(250,204,21,.22)",
    background: "rgba(250,204,21,.08)",
    color: "#facc15",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
};