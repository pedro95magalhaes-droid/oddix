"use client";

import type { CSSProperties } from "react";

export default function ResultsStats({ totalBets = 0, wonBets = 0, lostBets = 0, roi = 0 }: { totalBets?: number; wonBets?: number; lostBets?: number; roi?: number; recent?: any[] }) {
  const finished = Number(wonBets || 0) + Number(lostBets || 0);
  const hitRate = finished ? Math.round((Number(wonBets || 0) / finished) * 100) : 0;

  return (
    <section style={styles.card} className="oddix-v36-results">
      <div style={styles.header}>
        <strong>📊 RESULTADOS REAIS</strong>
      </div>

      <div style={styles.grid}>
        <Metric label="Greens" value={wonBets} tone="green" />
        <Metric label="Reds" value={lostBets} tone="red" />
        <Metric label="Assertividade" value={`${hitRate}%`} tone="green" bars />
        <Metric label="ROI" value={`${roi || 0}%`} tone="green" />
        <div style={styles.sideBox}>
          <strong>DESEMPENHO GERAL</strong>
          <span>Jogos Analisados <b>{totalBets || 0}</b></span>
          <span>Tips Vencedoras <b>{wonBets}</b></span>
          <span>Tips Perdedoras <b>{lostBets}</b></span>
          <span>Void / Push <b>0</b></span>
          <span>ROI Médio <b style={{ color: "#22c55e" }}>+{roi || 0}%</b></span>
        </div>
      </div>
      <small style={styles.note}>* Números atualizados automaticamente com base nas análises da IA Oddix.</small>
    </section>
  );
}

function Metric({ label, value, tone, bars }: { label: string; value: string | number; tone: "green" | "red"; bars?: boolean }) {
  const color = tone === "red" ? "#ef4444" : "#22c55e";
  return (
    <div style={styles.metric}>
      <strong style={{ ...styles.value, color }}>{value}</strong>
      <span>{label}</span>
      <small>ÚLTIMOS 30 DIAS</small>
      {bars ? <div style={styles.bars}>{Array.from({ length: 8 }).map((_, i) => <i key={i} style={{ height: 12 + i * 4 }} />)}</div> : <div style={{ ...styles.spark, borderColor: color }} />}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { background: "linear-gradient(145deg,#050505,#09090b)", color: "#fff", borderRadius: 17, padding: 18, border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 22px 58px rgba(0,0,0,.42)" },
  header: { color: "#f8fafc", fontSize: 15, marginBottom: 14 },
  grid: { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr)) minmax(150px,.85fr)", gap: 12 },
  metric: { minHeight: 144, display: "grid", alignContent: "space-between", gap: 7, padding: 16, borderRadius: 11, background: "linear-gradient(145deg,#080808,#111827)", border: "1px solid rgba(255,255,255,.14)" },
  value: { fontSize: 42, lineHeight: .9, letterSpacing: -1.4 },
  spark: { height: 28, borderBottom: "2px solid", borderRadius: 12, background: "linear-gradient(135deg,transparent 40%,rgba(34,197,94,.85) 42% 46%,transparent 48%)" },
  bars: { display: "flex", alignItems: "end", gap: 6, height: 34 },
  sideBox: { display: "grid", gap: 8, padding: 13, borderRadius: 11, background: "#050505", border: "1px solid rgba(255,255,255,.11)", fontSize: 12 },
  note: { display: "block", marginTop: 12, color: "#a1a1aa", fontWeight: 700 },
};
