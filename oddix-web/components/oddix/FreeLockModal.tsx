"use client";

import type { CSSProperties } from "react";

export default function FreeLockModal({
  open,
  onClose,
  onUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  if (!open) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button style={styles.close} onClick={onClose}>×</button>

        <span style={styles.lock}>🔒</span>
        <h2>Análise disponível no PRO/VIP</h2>

        <p>
          No Free você acompanha jogos, odds e ranking. Para ver análise completa,
          mercados inteligentes, Player Props e Oddix Boost, escolha um plano.
        </p>

        <div style={styles.features}>
          <span>🤖 Análise IA completa</span>
          <span>🎯 Player Props quando houver mercado real</span>
          <span>💎 Oddix Boost filtrado</span>
          <span>📲 VIP com grupo, mentoria e banca</span>
        </div>

        <div style={styles.actions}>
          <button style={styles.secondary} onClick={onClose}>Continuar no Free</button>
          <button style={styles.primary} onClick={onUpgrade}>Ver planos</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 999,
    background: "rgba(0,0,0,.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    background: "linear-gradient(145deg,#111827,#4c1d95)",
    color: "#fff",
    borderRadius: 30,
    padding: 28,
    position: "relative",
    border: "1px solid rgba(255,255,255,.16)",
    boxShadow: "0 30px 90px rgba(0,0,0,.55)",
  },
  close: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 999,
    border: 0,
    background: "rgba(255,255,255,.12)",
    color: "#fff",
    fontSize: 22,
    cursor: "pointer",
  },
  lock: {
    width: 54,
    height: 54,
    borderRadius: 18,
    background: "rgba(250,204,21,.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
  },
  features: {
    display: "grid",
    gap: 10,
    margin: "18px 0",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  secondary: {
    background: "rgba(255,255,255,.10)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 15,
    padding: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  primary: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 15,
    padding: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
};
