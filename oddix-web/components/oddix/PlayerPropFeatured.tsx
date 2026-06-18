"use client";

import type { CSSProperties } from "react";

function playerName(prop: any) {
  return prop?.playerName || prop?.player || prop?.name || "Jogador em destaque";
}

function playerPhoto(prop: any) {
  return prop?.playerPhoto || prop?.photo || prop?.image || prop?.avatar || "";
}

export default function PlayerPropFeatured({
  prop,
  loading = false,
  isPaidPlan = false,
  onOpen,
  onUpgrade,
}: {
  prop?: any;
  loading?: boolean;
  isPaidPlan?: boolean;
  onOpen: (prop: any) => void;
  onUpgrade: () => void;
}) {
  if (loading) {
    return (
      <section style={styles.card}>
        <span style={styles.kicker}>🎯 PLAYER PROP DO DIA</span>
        <h2 style={styles.title}>Buscando mercado premium...</h2>
        <p style={styles.text}>A Oddix está procurando jogador com foto real, mercado válido e confiança alta.</p>
      </section>
    );
  }

  if (!prop) {
    return (
      <section style={styles.emptyCard}>
        <span style={styles.kicker}>🎯 PLAYER PROP DO DIA</span>
        <h2 style={styles.title}>Aguardando Player Props reais</h2>
        <p style={styles.text}>Sem jogador fake: quando houver escalação, foto real e mercado válido, o destaque aparece aqui.</p>
      </section>
    );
  }

  const photo = playerPhoto(prop);
  const confidence = Number(prop?.confidence ?? prop?.confianca ?? prop?.confiança ?? 0);

  return (
    <section style={styles.card} className="oddix-v35-playerprop">
      <div style={styles.info}>
        <span style={styles.kicker}>🎯 PLAYER PROP DO DIA</span>
        <h2 style={styles.title}>{playerName(prop)}</h2>
        <p style={styles.text}>{prop?.game || `${prop?.homeTeam || "Casa"} x ${prop?.awayTeam || "Fora"}`}</p>

        <div style={styles.marketBox}>
          <span>Mercado</span>
          <strong>{prop?.tip || prop?.selection || "Over 0.5 chute no gol"}</strong>
        </div>

        <div style={styles.metrics}>
          <div>
            <span>Odd</span>
            <strong>{prop?.odd || "-"}</strong>
          </div>
          <div>
            <span>Confiança</span>
            <strong>{confidence || 0}%</strong>
          </div>
          <div>
            <span>Risco</span>
            <strong>{prop?.risk || prop?.risco || "Médio"}</strong>
          </div>
        </div>

        <button style={styles.button} onClick={() => (isPaidPlan ? onOpen(prop) : onUpgrade())}>
          {isPaidPlan ? "Abrir análise" : "Desbloquear Player Props"}
        </button>
      </div>

      <div style={styles.photoWrap}>
        {photo ? <img style={styles.photo} src={photo} alt={playerName(prop)} /> : <div style={styles.noPhoto}>Sem foto</div>}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) minmax(220px,340px)",
    gap: 18,
    alignItems: "stretch",
    background:
      "radial-gradient(circle at 76% 18%,rgba(250,204,21,.24),transparent 32%),linear-gradient(135deg,#111827,#312e81,#581c87)",
    color: "#fff",
    borderRadius: 30,
    padding: 22,
    border: "1px solid rgba(255,255,255,.16)",
    boxShadow: "0 24px 70px rgba(76,29,149,.25)",
    minHeight: 360,
  },
  emptyCard: {
    background: "linear-gradient(145deg,#111827,#1e1b4b)",
    color: "#fff",
    borderRadius: 30,
    padding: 22,
    border: "1px dashed rgba(255,255,255,.18)",
    minHeight: 260,
  },
  info: {
    position: "relative",
    zIndex: 2,
  },
  kicker: {
    color: "#facc15",
    fontWeight: 1000,
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    margin: "8px 0",
    fontSize: "clamp(28px,3vw,44px)",
    lineHeight: 1,
  },
  text: {
    color: "#ddd6fe",
    marginTop: 0,
  },
  marketBox: {
    marginTop: 18,
    background: "rgba(255,255,255,.10)",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 20,
    padding: 16,
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 10,
    marginTop: 14,
  },
  button: {
    marginTop: 16,
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 16,
    padding: "14px 18px",
    cursor: "pointer",
    fontWeight: 1000,
  },
  photoWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    background: "rgba(255,255,255,.10)",
    border: "1px solid rgba(255,255,255,.14)",
    minHeight: 300,
  },
  photo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  noPhoto: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#cbd5e1",
    fontWeight: 900,
  },
};
