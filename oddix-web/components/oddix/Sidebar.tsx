"use client";

import type { CSSProperties } from "react";

type MenuKey =
  | "dashboard"
  | "top-picks"
  | "player-props"
  | "boost"
  | "live"
  | "results"
  | "favorites"
  | "vip"
  | "support"
  | "settings";

const MENU: { key: MenuKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "🏠" },
  { key: "top-picks", label: "Top Picks", icon: "🔥" },
  { key: "player-props", label: "Player Props", icon: "🎯" },
  { key: "boost", label: "Oddix Boost", icon: "⚡" },
  { key: "live", label: "Ao Vivo", icon: "📡" },
  { key: "results", label: "Resultados", icon: "📊" },
  { key: "favorites", label: "Favoritos", icon: "⭐" },
  { key: "vip", label: "VIP", icon: "👑" },
  { key: "support", label: "Suporte", icon: "💬" },
  { key: "settings", label: "Configurações", icon: "⚙️" },
];

export default function Sidebar({
  active = "dashboard",
  plan = "Free",
  onNavigate,
  onUpgrade,
  onSupport,
}: {
  active?: MenuKey | string;
  plan?: string;
  onNavigate: (key: MenuKey) => void;
  onUpgrade: () => void;
  onSupport?: () => void;
}) {
  return (
    <aside style={styles.sidebar} className="oddix-v35-sidebar">
      <div style={styles.brand}>
        <div style={styles.logo}>O</div>
        <div>
          <strong style={styles.brandTitle}>ODDIX AI</strong>
          <span style={styles.brandSub}>Sports Intelligence</span>
        </div>
      </div>

      <div style={styles.planBox}>
        <span style={styles.planLabel}>Plano atual</span>
        <strong style={styles.planName}>{plan || "Free"}</strong>
      </div>

      <nav style={styles.nav}>
        {MENU.map((item) => {
          const selected = item.key === active;
          return (
            <button
              key={item.key}
              style={selected ? styles.navItemActive : styles.navItem}
              onClick={() => {
                if (item.key === "support" && onSupport) {
                  onSupport();
                  return;
                }
                onNavigate(item.key);
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={styles.vipCard}>
        <span style={styles.vipKicker}>ODDIX VIP</span>
        <strong>Desbloqueie a plataforma completa</strong>
        <p>Top Picks, Player Props, Boost e análises avançadas com IA.</p>
        <button style={styles.vipButton} onClick={onUpgrade}>Liberar VIP</button>
      </div>
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  sidebar: {
    width: "100%",
    background: "linear-gradient(180deg,rgba(15,23,42,.98),rgba(17,24,39,.96))",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 28,
    padding: 16,
    boxShadow: "0 24px 70px rgba(0,0,0,.28)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 16,
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 1000,
    fontSize: 24,
  },
  brandTitle: {
    display: "block",
    fontSize: 16,
    letterSpacing: .5,
  },
  brandSub: {
    display: "block",
    color: "#cbd5e1",
    fontSize: 12,
    marginTop: 2,
  },
  planBox: {
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 18,
    padding: 13,
    marginBottom: 14,
  },
  planLabel: {
    display: "block",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  planName: {
    display: "block",
    marginTop: 4,
    color: "#facc15",
    fontSize: 18,
  },
  nav: {
    display: "grid",
    gap: 8,
  },
  navItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "transparent",
    color: "#e5e7eb",
    border: "1px solid transparent",
    borderRadius: 16,
    padding: "12px 12px",
    cursor: "pointer",
    fontWeight: 900,
    textAlign: "left",
  },
  navItemActive: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "linear-gradient(135deg,rgba(250,204,21,.22),rgba(251,146,60,.16))",
    color: "#fff",
    border: "1px solid rgba(250,204,21,.28)",
    borderRadius: 16,
    padding: "12px 12px",
    cursor: "pointer",
    fontWeight: 1000,
    textAlign: "left",
  },
  navIcon: {
    width: 26,
    display: "inline-flex",
    justifyContent: "center",
  },
  vipCard: {
    marginTop: 16,
    background: "linear-gradient(145deg,#4c1d95,#7c2d12)",
    border: "1px solid rgba(250,204,21,.24)",
    borderRadius: 22,
    padding: 16,
  },
  vipKicker: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: 1000,
    letterSpacing: 1,
  },
  vipButton: {
    width: "100%",
    marginTop: 10,
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 14,
    padding: 12,
    cursor: "pointer",
    fontWeight: 1000,
  },
};
