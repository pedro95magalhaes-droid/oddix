"use client";

const VIP_LINK = process.env.NEXT_PUBLIC_ODDIX_VIP_LINK || "https://www.asaas.com/c/htvg25um0tpbr7bx";
const PRO_LINK = process.env.NEXT_PUBLIC_ODDIX_PRO_LINK || "https://www.asaas.com/c/ghmckkqfrfkan6z1";
const FREE_GROUP_LINK = "https://chat.whatsapp.com/JQuwv77T1b8J6KMlXCEeRb";

export default function OddixVipPage() {
  const benefits = [
    ["🔥 Top Picks VIP", "Entradas filtradas pela IA V3 com score profissional e controle de risco."],
    ["⚡ Oddix Boost", "Bilhetes combinados com odd total, confiança e retorno potencial."],
    ["👤 Player Props Reais", "Jogadores com foto real, escalação e mercados confiáveis quando disponíveis."],
    ["📲 WhatsApp VIP", "Alertas automáticos direto no grupo VIP com cards premium."],
    ["✅ Greens em tempo real", "Histórico de resultados, GREEN/RED e acompanhamento do cron."],
    ["🧠 IA Proprietária", "Confidence Engine V3 bloqueia entradas fracas e libera apenas leitura segura."],
  ];

  const metrics = [
    ["87+", "Greens monitorados", "#22c55e"],
    ["79%", "Win rate alvo", "#facc15"],
    ["+500", "Mercados analisados", "#a855f7"],
    ["V3", "IA profissional", "#38bdf8"],
  ];

  const comparison = [
    ["Entradas", "Amostras", "Top Picks completas"],
    ["Oddix Boost", "Limitado", "Bilhete oficial"],
    ["Player Props", "Não incluso", "Props reais quando disponíveis"],
    ["WhatsApp", "Grupo FREE", "Grupo VIP premium"],
    ["Análise IA", "Resumo", "Leitura completa V3"],
    ["Prioridade", "Baixa", "Alta"],
  ];

  const testimonials = [
    ["⭐⭐⭐⭐⭐", "As entradas ficaram muito mais organizadas. O grupo VIP ajuda a evitar aposta no impulso."],
    ["⭐⭐⭐⭐⭐", "O Oddix Boost e os alertas no WhatsApp deixam tudo mais prático para acompanhar."],
    ["⭐⭐⭐⭐⭐", "Gostei porque a IA também bloqueia jogo ruim. Isso passa mais confiança."],
  ];

  return (
    <main style={styles.page}>

      <style jsx global>{`
        * { box-sizing: border-box; }
        @media (max-width: 980px) {
          main section { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          main { padding: 10px !important; }
          h1 { font-size: 30px !important; letter-spacing: -1px !important; }
          section { max-width: 100% !important; }
          button { width: 100%; }
        }
      `}</style>

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <span style={styles.kicker}>ODDIX VIP • IA V3</span>
          <h1 style={styles.title}>Entre no grupo que recebe as melhores leituras da IA.</h1>
          <p style={styles.subtitle}>
            Top Picks, Oddix Boost, Player Props reais e alertas no WhatsApp para quem quer operar com mais organização e menos chute.
          </p>

          <div style={styles.actions}>
            <button style={styles.vipButton} onClick={() => window.open(VIP_LINK, "_blank", "noopener,noreferrer")}>Assinar VIP</button>
            <button style={styles.proButton} onClick={() => window.open(PRO_LINK, "_blank", "noopener,noreferrer")}>Ver plano PRO</button>
            <button style={styles.freeButton} onClick={() => window.open(FREE_GROUP_LINK, "_blank", "noopener,noreferrer")}>Entrar no FREE</button>
          </div>
        </div>

        <div style={styles.ticket}>
          <span style={styles.ticketKicker}>BILHETE OFICIAL</span>
          <strong style={styles.ticketReturn}>R$488</strong>
          <small style={styles.ticketSmall}>simulação com R$100</small>
          <div style={styles.ticketGrid}>
            <div><span>Odd</span><b>4.88</b></div>
            <div><span>Confiança</span><b>88%</b></div>
          </div>
          <div style={styles.ticketLine}>✓ Top Pick VIP</div>
          <div style={styles.ticketLine}>✓ Oddix Boost</div>
          <div style={styles.ticketLine}>✓ Player Props</div>
          <button style={styles.ticketButton} onClick={() => window.open(VIP_LINK, "_blank", "noopener,noreferrer")}>Quero receber bilhetes</button>
        </div>
      </section>

      <section style={styles.metricsGrid}>
        {metrics.map(([value, label, color]) => (
          <div key={label} style={styles.metricCard}>
            <strong style={{ color }}>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section style={styles.comparisonBox}>
        <div style={styles.sectionHead}>
          <span style={styles.kicker}>FREE X VIP</span>
          <h2>Veja o que muda quando você entra no VIP</h2>
        </div>

        <div style={styles.comparisonGrid}>
          <div style={styles.comparisonHeader}>Recurso</div>
          <div style={styles.comparisonHeader}>FREE</div>
          <div style={styles.comparisonHeaderVip}>VIP</div>
          {comparison.map(([feature, free, vip]) => (
            <FragmentRow key={feature} feature={feature} free={free} vip={vip} />
          ))}
        </div>
      </section>

      <section style={styles.benefitsGrid}>
        {benefits.map(([title, text]) => (
          <article key={title} style={styles.benefitCard}>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section style={styles.testimonialsGrid}>
        {testimonials.map(([stars, text], index) => (
          <article key={index} style={styles.testimonialCard}>
            <strong>{stars}</strong>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section style={styles.ctaBox}>
        <div>
          <span style={styles.kicker}>PRONTO PARA VIRAR VIP?</span>
          <h2>Receba as melhores entradas no WhatsApp.</h2>
          <p>Assine, entre no grupo e acompanhe as leituras premium da Oddix.</p>
        </div>
        <button style={styles.vipButton} onClick={() => window.open(VIP_LINK, "_blank", "noopener,noreferrer")}>Quero ser VIP</button>
      </section>
    </main>
  );
}

function FragmentRow({ feature, free, vip }: { feature: string; free: string; vip: string }) {
  return (
    <>
      <div style={styles.comparisonCellFeature}>{feature}</div>
      <div style={styles.comparisonCell}>{free}</div>
      <div style={styles.comparisonCellVip}>{vip}</div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 18,
    color: "#fff",
    background:
      "radial-gradient(circle at 20% 0%, rgba(124,58,237,.34), transparent 35%), radial-gradient(circle at 85% 10%, rgba(250,204,21,.12), transparent 30%), linear-gradient(180deg,#07070D,#110522 55%,#07070D)",
    fontFamily: "Inter, Arial, sans-serif",
  },
  hero: {
    maxWidth: 1440,
    margin: "0 auto 22px",
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 320px",
    gap: 14,
    alignItems: "stretch",
  },
  heroContent: {
    borderRadius: 22,
    padding: 18,
    background: "linear-gradient(135deg, rgba(17,12,31,.96), rgba(36,14,74,.88))",
    border: "1px solid rgba(250,204,21,.24)",
    boxShadow: "0 24px 70px rgba(0,0,0,.38)",
  },
  kicker: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    color: "#facc15",
    background: "rgba(250,204,21,.12)",
    border: "1px solid rgba(250,204,21,.22)",
    fontSize: 11,
    fontWeight: 1000,
    letterSpacing: 1.2,
  },
  title: {
    margin: "20px 0 14px",
    maxWidth: 760,
    fontSize: "clamp(28px, 4.2vw, 56px)",
    lineHeight: .92,
    letterSpacing: -1.8,
    fontWeight: 1000,
  },
  subtitle: {
    maxWidth: 720,
    color: "rgba(255,255,255,.76)",
    fontSize: 14,
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 28,
  },
  vipButton: {
    height: 40,
    padding: "0 16px",
    border: 0,
    borderRadius: 16,
    color: "#111827",
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    fontWeight: 1000,
    cursor: "pointer",
  },
  proButton: {
    height: 40,
    padding: "0 16px",
    border: "1px solid rgba(168,85,247,.40)",
    borderRadius: 16,
    color: "#fff",
    background: "linear-gradient(135deg,#7c3aed,#a855f7)",
    fontWeight: 1000,
    cursor: "pointer",
  },
  freeButton: {
    height: 40,
    padding: "0 16px",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 16,
    color: "#fff",
    background: "rgba(255,255,255,.07)",
    fontWeight: 1000,
    cursor: "pointer",
  },
  ticket: {
    borderRadius: 22,
    padding: 18,
    background: "linear-gradient(180deg, rgba(13,7,24,.98), rgba(7,7,13,.98))",
    border: "1px solid rgba(250,204,21,.26)",
    boxShadow: "0 24px 70px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.10)",
  },
  ticketKicker: { color: "rgba(255,255,255,.68)", fontSize: 11, fontWeight: 1000, letterSpacing: 1.1 },
  ticketReturn: { display: "block", marginTop: 14, color: "#facc15", fontSize: 54, lineHeight: .9, fontWeight: 1000 },
  ticketSmall: { color: "rgba(255,255,255,.56)", fontWeight: 900 },
  ticketGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "22px 0" },
  ticketLine: { padding: 12, borderRadius: 14, background: "rgba(255,255,255,.06)", marginTop: 8, color: "rgba(255,255,255,.86)", fontWeight: 900 },
  ticketButton: { width: "100%", marginTop: 16, border: 0, borderRadius: 16, padding: "14px 16px", color: "#111827", background: "linear-gradient(135deg,#facc15,#fb923c)", fontWeight: 1000, cursor: "pointer" },
  metricsGrid: { maxWidth: 1440, margin: "0 auto 22px", display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 },
  metricCard: { padding: 16, borderRadius: 22, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" },
  comparisonBox: { maxWidth: 1440, margin: "0 auto 22px", padding: 18, borderRadius: 22, background: "linear-gradient(135deg, rgba(17,12,31,.96), rgba(36,14,74,.72))", border: "1px solid rgba(250,204,21,.18)" },
  sectionHead: { marginBottom: 16 },
  comparisonGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1.25fr", gap: 8 },
  comparisonHeader: { padding: 14, borderRadius: 16, color: "rgba(255,255,255,.70)", background: "rgba(255,255,255,.06)", fontWeight: 1000 },
  comparisonHeaderVip: { padding: 14, borderRadius: 16, color: "#111827", background: "linear-gradient(135deg,#facc15,#fb923c)", fontWeight: 1000 },
  comparisonCellFeature: { padding: 14, borderRadius: 16, background: "rgba(255,255,255,.05)", color: "#fff", fontWeight: 950 },
  comparisonCell: { padding: 14, borderRadius: 16, background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.65)", fontWeight: 850 },
  comparisonCellVip: { padding: 14, borderRadius: 16, background: "rgba(250,204,21,.09)", border: "1px solid rgba(250,204,21,.16)", color: "#fff", fontWeight: 950 },
  benefitsGrid: { maxWidth: 1440, margin: "0 auto 22px", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 },
  benefitCard: { padding: 16, borderRadius: 22, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" },
  testimonialsGrid: { maxWidth: 1440, margin: "0 auto 22px", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 },
  testimonialCard: { padding: 16, borderRadius: 22, background: "rgba(34,197,94,.07)", border: "1px solid rgba(34,197,94,.16)" },
  ctaBox: { maxWidth: 1440, margin: "0 auto", padding: 20, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, background: "linear-gradient(135deg, rgba(250,204,21,.14), rgba(124,58,237,.18))", border: "1px solid rgba(250,204,21,.24)" },
};
