"use client";

import type { CSSProperties } from "react";

function playerName(prop: any) { return prop?.playerName || prop?.player || prop?.name || "Jogador em destaque"; }
function playerPhoto(prop: any) { return prop?.playerPhoto || prop?.photo || prop?.image || prop?.avatar || ""; }

export default function PlayerPropFeatured({ prop, loading = false, isPaidPlan = false, onOpen, onUpgrade }: { prop?: any; loading?: boolean; isPaidPlan?: boolean; onOpen: (prop: any) => void; onUpgrade: () => void }) {
  const confidence = Number(prop?.confidence ?? prop?.confianca ?? prop?.confiança ?? 0);

  if (loading || !prop) {
    return (
      <section style={styles.card} className="oddix-v36-playerprop">
        <div style={styles.head}><strong>🔥 PLAYER PROP DO DIA</strong><span>PREMIUM</span></div>
        <h2 style={styles.title}>{loading ? "Buscando mercado premium..." : "Aguardando Player Props reais"}</h2>
        <p style={styles.text}>Sem jogador fake: aparece aqui quando houver foto real, escalação e mercado válido.</p>
      </section>
    );
  }

  return (
    <section style={styles.card} className="oddix-v36-playerprop">
      <div style={styles.head}><strong>🔥 PLAYER PROP DO DIA</strong><span>PREMIUM</span></div>
      <div style={styles.body}>
        <div style={styles.photoBox}>{playerPhoto(prop) ? <img style={styles.photo} src={playerPhoto(prop)} alt={playerName(prop)} /> : null}</div>
        <div style={styles.info}>
          <h2 style={styles.title}>{playerName(prop)}</h2>
          <p style={styles.text}>{prop?.game || `${prop?.homeTeam || "Casa"} x ${prop?.awayTeam || "Fora"}`}</p>
          <div style={styles.market}><span>MERCADO</span><strong>{prop?.tip || prop?.selection || "Over 0.5 chute no gol"}</strong></div>
          <div style={styles.metrics}>
            <div><span>ODD</span><strong>{prop?.odd || "-"}</strong></div>
            <div><span>CONFIANÇA</span><strong>{confidence || 0}%</strong></div>
          </div>
        </div>
      </div>
      <button style={styles.button} onClick={() => (isPaidPlan ? onOpen(prop) : onUpgrade())}>VER ANÁLISE COMPLETA →</button>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { position: "relative", overflow: "hidden", display: "grid", gap: 12, minHeight: 272, color: "#fff", borderRadius: 17, padding: 16, background: "radial-gradient(circle at 95% 0%,rgba(124,58,237,.55),transparent 34%),linear-gradient(145deg,#07070d,#0b0711 68%,#260339)", border: "1px solid rgba(168,85,247,.45)", boxShadow: "0 22px 58px rgba(0,0,0,.42)" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 15 },
  body: { display: "grid", gridTemplateColumns: "135px 1fr", gap: 15, alignItems: "end" },
  photoBox: { height: 178, borderRadius: 15, overflow: "hidden", background: "linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.04))", display: "grid", placeItems: "end center" },
  photo: { width: "100%", height: "100%", objectFit: "contain", objectPosition: "center bottom", transform: "scale(.88)", transformOrigin: "center bottom", filter: "drop-shadow(0 18px 24px rgba(0,0,0,.5))" },
  info: { minWidth: 0 },
  title: { margin: "0 0 4px", fontSize: "clamp(22px,1.65vw,28px)", textTransform: "uppercase", lineHeight: 1 },
  text: { margin: "0 0 10px", color: "#cbd5e1", fontWeight: 700 },
  market: { display: "grid", gap: 4, padding: 12, borderRadius: 11, background: "rgba(0,0,0,.36)", border: "1px solid rgba(255,255,255,.12)" },
  metrics: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },
  button: { border: 0, borderRadius: 10, background: "linear-gradient(180deg,#7c3aed,#581c87)", color: "#fff", padding: "12px 15px", fontWeight: 1000, cursor: "pointer" },
};
