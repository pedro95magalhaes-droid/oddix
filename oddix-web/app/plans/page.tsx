"use client";

import type { CSSProperties } from "react";

const PRO_LINK = "https://www.asaas.com/c/ghmckkqfrfkan6z1";
const VIP_LINK = "https://www.asaas.com/c/htvg25um0tpbr7bx";
const LEGAL_SEAL_DARK = "/selos/estrelabet-responsabilidade-dark.png";
const LEGAL_SEAL_BLUE = "/selos/estrelabet-responsabilidade-blue.png";
const ESTRELABET_LINK = process.env.NEXT_PUBLIC_ESTRELABET_LINK || "https://apretailer.com.br/click/6a2102c82bfa8143b57b86d8/182492/359080/subaccount";

export default function PlansPage() {
  return (
    <main style={styles.page}>
      <div style={styles.bgGlowOne} />
      <div style={styles.bgGlowTwo} />

      <header style={styles.header}>
        <button style={styles.logoButton} onClick={() => (window.location.href = "/dashboard")}>
          <img src="/logo-oddix-horizontal.png" alt="Oddix" style={styles.logo} />
        </button>

        <div style={styles.headerActions}>
          <button style={styles.secondaryHeaderButton} onClick={() => (window.location.href = "/dashboard")}>
            Dashboard
          </button>
          <button style={styles.secondaryHeaderButton} onClick={() => window.open(ESTRELABET_LINK, "_blank")}>
            💰 EstrelaBet
          </button>
          <button style={styles.headerButton} onClick={() => window.open(VIP_LINK, "_blank")}>
            Entrar no VIP
          </button>
        </div>
      </header>

      <section style={styles.hero}>
        <div style={styles.heroLeft}>
          <span style={styles.kicker}>ODDIX PRO & VIP</span>
          <h1 style={styles.title}>Transforme análise em entrada premium.</h1>
          <p style={styles.subtitle}>
            A Oddix usa IA para filtrar jogos, mercados, Player Props, combinadas e alertas ao vivo.
            Escolha o plano ideal e receba uma experiência mais profissional para acompanhar suas entradas.
          </p>

          <div style={styles.heroActions}>
            <button style={styles.primaryCta} onClick={() => window.open(VIP_LINK, "_blank")}>
              👑 ENTRAR NO VIP AGORA
            </button>
            <button style={styles.secondaryCta} onClick={() => window.open(PRO_LINK, "_blank")}>
              🔥 QUERO SER PRO
            </button>
            <button style={styles.partnerCta} onClick={() => window.open(ESTRELABET_LINK, "_blank")}>
              💰 APOSTAR NA ESTRELABET
            </button>
          </div>

          <div style={styles.trustRow}>
            <Metric value="IA" label="Análise automática" />
            <Metric value="24h" label="Sistema online" />
            <Metric value="VIP" label="WhatsApp exclusivo" />
          </div>
        </div>

        <div style={styles.heroRight}>
          <div style={styles.liveCard}>
            <span style={styles.livePill}>● Oddix Monitor</span>
            <strong style={styles.liveTitle}>Palpites com IA + Gestão</strong>
            <p style={styles.liveText}>
              Cards premium, áudios GREEN/RED, Almost Green, Player Props e combinadas inteligentes.
            </p>
            <div style={styles.liveGrid}>
              <MiniBox label="Confiança" value="88%" />
              <MiniBox label="Odd média" value="1.70" />
              <MiniBox label="Mercado" value="Props" />
              <MiniBox label="Risco" value="Baixo" />
            </div>
          </div>
        </div>
      </section>

      <section style={styles.planGrid}>
        <PlanCard
          name="FREE"
          price="R$ 0"
          tag="Comece agora"
          description="Para conhecer a plataforma e acompanhar os jogos filtrados."
          items={[
            "Dashboard de jogos",
            "Ao vivo e pré-jogo",
            "Ranking de qualidade",
            "Odds básicas",
            "Sem análise completa da IA",
          ]}
          button="Continuar Free"
          onClick={() => (window.location.href = "/dashboard")}
        />

        <PlanCard
          featured
          badge="🔥 MAIS VENDIDO"
          name="PRO"
          price="R$ 19,99"
          tag="Análise premium"
          description="Para liberar análises da IA, Player Props e combinadas inteligentes."
          items={[
            "Tudo do Free",
            "Análise completa da IA",
            "Mercados inteligentes",
            "Player Props",
            "Oddix Boost",
            "Múltiplas filtradas",
          ]}
          button="🔥 QUERO SER PRO"
          onClick={() => window.open(PRO_LINK, "_blank")}
        />

        <PlanCard
          vip
          badge="⭐ MAIS COMPLETO"
          name="VIP"
          price="R$ 39,99"
          tag="Sala exclusiva"
          description="Acesso completo com grupo VIP, alertas por voz e acompanhamento em tempo real."
          items={[
            "Tudo do PRO",
            "Grupo VIP no WhatsApp",
            "Áudios GREEN/RED",
            "Almost Green",
            "Cards premium",
            "Suporte prioritário",
          ]}
          button="👑 ENTRAR NO VIP AGORA"
          onClick={() => window.open(VIP_LINK, "_blank")}
        />
      </section>


      <section style={styles.partnerSection}>
        <div style={styles.partnerContent}>
          <span style={styles.partnerSeal}>🤝 PARCERIA ODDIX + ESTRELABET</span>
          <h2 style={styles.partnerTitle}>Faça sua entrada com uma casa parceira.</h2>
          <p style={styles.partnerText}>
            Use o link oficial da Oddix para criar sua conta na EstrelaBet e acompanhar as entradas com mais praticidade.
            A Oddix fornece análise, gestão e IA; a aposta é sempre sua decisão.
          </p>
          <div style={styles.partnerBadges}>
            <span>✅ Link oficial de afiliado</span>
            <span>🎁 Promoções para novos usuários</span>
            <span>⚠️ Jogue com responsabilidade</span>
          </div>
          <img src={LEGAL_SEAL_DARK} alt="18+ Jogue com responsabilidade. Aposta não é investimento." style={styles.partnerLegalSeal} />
        </div>
        <button style={styles.partnerButton} onClick={() => window.open(ESTRELABET_LINK, "_blank")}>
          💰 ABRIR ESTRELABET
        </button>
      </section>

      <section style={styles.compareSection}>
        <div style={styles.sectionHead}>
          <span style={styles.kicker}>COMPARATIVO</span>
          <h2 style={styles.sectionTitle}>Veja o que cada plano libera.</h2>
        </div>

        <div style={styles.compareTable}>
          {[
            ["Dashboard", "✅", "✅", "✅"],
            ["Análise IA completa", "❌", "✅", "✅"],
            ["Player Props", "❌", "✅", "✅"],
            ["Combinadas Oddix", "❌", "✅", "✅"],
            ["Grupo VIP WhatsApp", "❌", "❌", "✅"],
            ["Áudios GREEN/RED", "❌", "❌", "✅"],
            ["Almost Green", "❌", "❌", "✅"],
          ].map((row) => (
            <div key={row[0]} style={styles.compareRow}>
              <strong>{row[0]}</strong>
              <span>{row[1]}</span>
              <span>{row[2]}</span>
              <span>{row[3]}</span>
            </div>
          ))}

          <div style={styles.compareHeader}>
            <strong>Recurso</strong>
            <span>Free</span>
            <span>PRO</span>
            <span>VIP</span>
          </div>
        </div>
      </section>

      <section style={styles.finalCta}>
        <div>
          <span style={styles.kicker}>COMECE HOJE</span>
          <h2 style={styles.finalTitle}>Entre agora e receba uma experiência mais profissional.</h2>
          <p style={styles.finalText}>
            O pagamento é feito pelo Asaas. Após pagar, envie o comprovante no WhatsApp ou aguarde a liberação pelo painel.
          </p>
        </div>

        <div style={styles.finalButtons}>
          <button style={styles.proButton} onClick={() => window.open(PRO_LINK, "_blank")}>
            Assinar PRO — R$ 19,99
          </button>
          <button style={styles.vipButton} onClick={() => window.open(VIP_LINK, "_blank")}>
            Assinar VIP — R$ 39,99
          </button>
        </div>
      </section>

      <footer style={styles.footer}>
        <strong>ODDIX</strong>
        <span>IA • Gestão • Player Props • WhatsApp VIP</span>
        <img src={LEGAL_SEAL_DARK} alt="18+ Jogue com responsabilidade. Aposta não é investimento." style={styles.footerLegalSeal} />
      </footer>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div style={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniBox}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlanCard({
  name,
  price,
  tag,
  description,
  items,
  button,
  onClick,
  featured,
  vip,
  badge,
}: {
  name: string;
  price: string;
  tag: string;
  description: string;
  items: string[];
  button: string;
  onClick: () => void;
  featured?: boolean;
  vip?: boolean;
  badge?: string;
}) {
  return (
    <div style={vip ? styles.cardVip : featured ? styles.cardPro : styles.card}>
      {badge && <span style={styles.badge}>{badge}</span>}
      <span style={styles.planTag}>{tag}</span>
      <h3 style={styles.planName}>{name}</h3>
      <strong style={styles.price}>{price}</strong>
      <p style={styles.description}>{description}</p>

      <div style={styles.items}>
        {items.map((item) => (
          <span key={item}>✅ {item}</span>
        ))}
      </div>

      <button style={vip ? styles.buttonVip : featured ? styles.buttonPro : styles.button} onClick={onClick}>
        {button}
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    background: "radial-gradient(circle at top left,#3b0764 0,#0a0018 32%,#05030a 100%)",
    color: "#fff",
    fontFamily: "Arial, sans-serif",
    padding: 28,
  },
  bgGlowOne: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "rgba(168,85,247,.24)",
    filter: "blur(90px)",
    top: 40,
    left: -120,
    pointerEvents: "none",
  },
  bgGlowTwo: {
    position: "absolute",
    width: 480,
    height: 480,
    borderRadius: "50%",
    background: "rgba(250,204,21,.12)",
    filter: "blur(110px)",
    right: -160,
    top: 220,
    pointerEvents: "none",
  },
  header: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1280,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  logoButton: {
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.13)",
    borderRadius: 24,
    padding: "10px 18px",
    cursor: "pointer",
  },
  logo: {
    width: 240,
    height: 68,
    objectFit: "contain",
  },
  headerActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  secondaryHeaderButton: {
    background: "rgba(255,255,255,.10)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 999,
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 900,
  },
  headerButton: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 999,
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 900,
  },
  hero: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1280,
    margin: "54px auto 30px",
    display: "grid",
    gridTemplateColumns: "1.05fr .95fr",
    gap: 28,
    alignItems: "center",
  },
  heroLeft: {
    background: "linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.03))",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 34,
    padding: 34,
    boxShadow: "0 24px 80px rgba(0,0,0,.35)",
  },
  kicker: {
    color: "#facc15",
    fontWeight: 900,
    letterSpacing: 1.6,
    fontSize: 12,
  },
  title: {
    fontSize: 58,
    lineHeight: 1,
    margin: "16px 0",
    letterSpacing: -2,
  },
  subtitle: {
    color: "#ddd6fe",
    fontSize: 17,
    lineHeight: 1.65,
    maxWidth: 760,
  },
  heroActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 24,
  },
  primaryCta: {
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    border: 0,
    borderRadius: 18,
    padding: "16px 22px",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 14px 34px rgba(250,204,21,.22)",
  },
  secondaryCta: {
    background: "rgba(255,255,255,.10)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: 18,
    padding: "16px 22px",
    fontWeight: 950,
    cursor: "pointer",
  },
  partnerCta: {
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    border: 0,
    borderRadius: 18,
    padding: "16px 22px",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 14px 34px rgba(250,204,21,.22)",
  },
  partnerSection: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1280,
    margin: "22px auto 34px",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 18,
    alignItems: "center",
    background: "linear-gradient(135deg,rgba(250,204,21,.16),rgba(251,146,60,.10),rgba(76,29,149,.35))",
    border: "1px solid rgba(250,204,21,.32)",
    borderRadius: 30,
    padding: 26,
    boxShadow: "0 24px 80px rgba(0,0,0,.32)",
  },
  partnerContent: { display: "flex", flexDirection: "column", gap: 10 },
  partnerSeal: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 1.6,
  },
  partnerTitle: { margin: 0, fontSize: 34, lineHeight: 1.05 },
  partnerText: { margin: 0, color: "#ddd6fe", lineHeight: 1.6, maxWidth: 840 },
  partnerBadges: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 },
  partnerButton: {
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    border: 0,
    borderRadius: 18,
    padding: "18px 24px",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 14px 34px rgba(250,204,21,.22)",
  },

  trustRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 12,
    marginTop: 24,
  },
  metric: {
    background: "rgba(0,0,0,.22)",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  heroRight: {
    minHeight: 360,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  liveCard: {
    width: "100%",
    minHeight: 330,
    borderRadius: 34,
    padding: 28,
    background: "linear-gradient(145deg,rgba(76,29,149,.78),rgba(15,23,42,.92))",
    border: "1px solid rgba(250,204,21,.28)",
    boxShadow: "0 26px 90px rgba(0,0,0,.42)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  livePill: {
    alignSelf: "flex-start",
    background: "rgba(34,197,94,.14)",
    border: "1px solid rgba(34,197,94,.35)",
    color: "#86efac",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 900,
  },
  liveTitle: {
    fontSize: 34,
    lineHeight: 1.05,
  },
  liveText: {
    color: "#ddd6fe",
    lineHeight: 1.55,
  },
  liveGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,1fr)",
    gap: 12,
  },
  miniBox: {
    background: "rgba(0,0,0,.28)",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  planGrid: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1280,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 18,
  },
  card: {
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 30,
    padding: 26,
    display: "flex",
    flexDirection: "column",
    gap: 13,
  },
  cardPro: {
    background: "linear-gradient(145deg,rgba(124,58,237,.72),rgba(17,24,39,.92))",
    border: "1px solid rgba(168,85,247,.48)",
    borderRadius: 30,
    padding: 26,
    display: "flex",
    flexDirection: "column",
    gap: 13,
    boxShadow: "0 22px 70px rgba(124,58,237,.18)",
  },
  cardVip: {
    background: "linear-gradient(145deg,rgba(250,204,21,.22),rgba(76,29,149,.92))",
    border: "1px solid rgba(250,204,21,.50)",
    borderRadius: 30,
    padding: 26,
    display: "flex",
    flexDirection: "column",
    gap: 13,
    boxShadow: "0 22px 80px rgba(250,204,21,.16)",
  },
  badge: {
    alignSelf: "flex-start",
    background: "#facc15",
    color: "#111827",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 950,
    fontSize: 12,
  },
  planTag: {
    color: "#c4b5fd",
    fontWeight: 900,
  },
  planName: {
    margin: 0,
    fontSize: 28,
  },
  price: {
    fontSize: 46,
    fontWeight: 950,
  },
  description: {
    color: "#ddd6fe",
    minHeight: 48,
  },
  items: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 210,
    color: "#f8fafc",
  },
  button: {
    background: "#ffffff",
    color: "#111827",
    border: 0,
    borderRadius: 18,
    padding: 16,
    fontWeight: 950,
    cursor: "pointer",
    marginTop: "auto",
  },
  buttonPro: {
    background: "linear-gradient(135deg,#8b5cf6,#a855f7)",
    color: "#fff",
    border: 0,
    borderRadius: 18,
    padding: 16,
    fontWeight: 950,
    cursor: "pointer",
    marginTop: "auto",
  },
  buttonVip: {
    background: "linear-gradient(135deg,#22c55e,#facc15)",
    color: "#052e16",
    border: 0,
    borderRadius: 18,
    padding: 16,
    fontWeight: 950,
    cursor: "pointer",
    marginTop: "auto",
  },
  compareSection: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1280,
    margin: "28px auto 0",
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 30,
    padding: 26,
  },
  sectionHead: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 34,
    margin: "8px 0 0",
  },
  compareTable: {
    display: "flex",
    flexDirection: "column-reverse",
    gap: 8,
  },
  compareHeader: {
    display: "grid",
    gridTemplateColumns: "1.5fr repeat(3,1fr)",
    gap: 8,
    padding: 14,
    background: "rgba(250,204,21,.14)",
    borderRadius: 16,
    color: "#fef3c7",
    fontWeight: 950,
  },
  compareRow: {
    display: "grid",
    gridTemplateColumns: "1.5fr repeat(3,1fr)",
    gap: 8,
    padding: 14,
    background: "rgba(0,0,0,.22)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 16,
    alignItems: "center",
  },
  finalCta: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1280,
    margin: "28px auto 0",
    background: "linear-gradient(135deg,rgba(34,197,94,.18),rgba(124,58,237,.28))",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 30,
    padding: 28,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 22,
    alignItems: "center",
  },
  finalTitle: {
    fontSize: 32,
    margin: "8px 0",
  },
  finalText: {
    color: "#ddd6fe",
  },
  finalButtons: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 260,
  },
  proButton: {
    background: "#fff",
    color: "#111827",
    border: 0,
    borderRadius: 16,
    padding: 15,
    fontWeight: 950,
    cursor: "pointer",
  },
  vipButton: {
    background: "#22c55e",
    color: "#052e16",
    border: 0,
    borderRadius: 16,
    padding: 15,
    fontWeight: 950,
    cursor: "pointer",
  },
  footer: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1280,
    margin: "24px auto 0",
    color: "#c4b5fd",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 13,
  },
  partnerLegalSeal: {
    width: 520,
    maxWidth: "100%",
    height: "auto",
    display: "block",
    marginTop: 18,
    borderRadius: 16,
    background: "rgba(0,0,0,.20)",
  },
  footerLegalSeal: {
    width: 420,
    maxWidth: "100%",
    height: "auto",
    display: "block",
    marginTop: 10,
    opacity: .96,
  },

};
