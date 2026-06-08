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
    ["87+", "Greens monitorados"],
    ["79%", "Win rate alvo"],
    ["+500", "Mercados analisados"],
    ["V3", "IA profissional"],
  ];

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <span style={styles.kicker}>ODDIX VIP</span>
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
        </div>
      </section>

      <section style={styles.metricsGrid}>
        {metrics.map(([value, label]) => (
          <div key={label} style={styles.metricCard}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section style={styles.benefitsGrid}>
        {benefits.map(([title, text]) => (
          <article key={title} style={styles.benefitCard}>
            <h3>{title}</h3>
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 24,
    color: "#fff",
    background:
      "radial-gradient(circle at 20% 0%, rgba(124,58,237,.34), transparent 35%), radial-gradient(circle at 85% 10%, rgba(250,204,21,.12), transparent 30%), linear-gradient(180deg,#07070D,#110522 55%,#07070D)",
    fontFamily: "Inter, Arial, sans-serif",
  },
  hero: {
    maxWidth: 1240,
    margin: "0 auto 22px",
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 360px",
    gap: 20,
    alignItems: "stretch",
  },
  heroContent: {
    borderRadius: 30,
    padding: 36,
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
    fontSize: "clamp(38px, 6vw, 78px)",
    lineHeight: .92,
    letterSpacing: -2.8,
    fontWeight: 1000,
  },
  subtitle: {
    maxWidth: 720,
    color: "rgba(255,255,255,.76)",
    fontSize: 17,
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 28,
  },
  vipButton: {
    height: 48,
    padding: "0 22px",
    border: 0,
    borderRadius: 16,
    color: "#111827",
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    fontWeight: 1000,
    cursor: "pointer",
  },
  proButton: {
    height: 48,
    padding: "0 22px",
    border: "1px solid rgba(168,85,247,.40)",
    borderRadius: 16,
    color: "#fff",
    background: "linear-gradient(135deg,#7c3aed,#a855f7)",
    fontWeight: 1000,
    cursor: "pointer",
  },
  freeButton: {
    height: 48,
    padding: "0 22px",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 16,
    color: "#fff",
    background: "rgba(255,255,255,.07)",
    fontWeight: 1000,
    cursor: "pointer",
  },
  ticket: {
    borderRadius: 30,
    padding: 26,
    background: "linear-gradient(180deg, rgba(13,7,24,.98), rgba(7,7,13,.98))",
    border: "1px solid rgba(250,204,21,.26)",
    boxShadow: "0 24px 70px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.10)",
  },
  ticketKicker: { color: "rgba(255,255,255,.68)", fontSize: 11, fontWeight: 1000, letterSpacing: 1.1 },
  ticketReturn: { display: "block", marginTop: 14, color: "#facc15", fontSize: 72, lineHeight: .9, fontWeight: 1000 },
  ticketSmall: { color: "rgba(255,255,255,.56)", fontWeight: 900 },
  ticketGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "22px 0" },
  ticketLine: { padding: 12, borderRadius: 14, background: "rgba(255,255,255,.06)", marginTop: 8, color: "rgba(255,255,255,.86)", fontWeight: 900 },
  metricsGrid: { maxWidth: 1240, margin: "0 auto 22px", display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 },
  metricCard: { padding: 22, borderRadius: 22, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" },
  benefitsGrid: { maxWidth: 1240, margin: "0 auto 22px", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 },
  benefitCard: { padding: 22, borderRadius: 22, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" },
  ctaBox: { maxWidth: 1240, margin: "0 auto", padding: 28, borderRadius: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, background: "linear-gradient(135deg, rgba(250,204,21,.14), rgba(124,58,237,.18))", border: "1px solid rgba(250,204,21,.24)" },
};
