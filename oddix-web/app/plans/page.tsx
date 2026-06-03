"use client";

import type { CSSProperties } from "react";

const PRO_LINK = "https://www.asaas.com/c/ghmckkqfrfkan6z1";
const VIP_LINK = "https://www.asaas.com/c/htvg25um0tpbr7bx";

export default function PlansPage() {
  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <img
          src="/logo-oddix-horizontal.png"
          alt="Oddix"
          style={styles.logo}
        />

        <button
          style={styles.backButton}
          onClick={() => (window.location.href = "/dashboard")}
        >
          Voltar ao dashboard
        </button>
      </header>

      <section style={styles.hero}>
        <span style={styles.kicker}>PLANOS ODDIX</span>

        <h1>Escolha o plano ideal para evoluir sua banca.</h1>

        <p>
          O Free permite conhecer a plataforma. O PRO libera análises da IA,
          Player Props e mercados inteligentes. O VIP libera grupo exclusivo,
          áudios, alertas e acompanhamento completo.
        </p>
      </section>

      <section style={styles.grid}>
        <Plan
          name="FREE"
          price="R$ 0"
          description="Conheça a plataforma."
          items={[
            "Dashboard de jogos",
            "Ao vivo e pré-jogo",
            "Ranking de qualidade",
            "Odds básicas",
            "Sem análises completas",
          ]}
          button="Continuar Free"
          onClick={() => (window.location.href = "/dashboard")}
        />

        <Plan
          featured
          name="PRO"
          price="R$ 19,99"
          description="Para liberar análises da IA."
          items={[
            "Tudo do Free",
            "Análise completa da IA",
            "Mercados inteligentes",
            "Player Props",
            "Oddix Boost",
            "Múltiplas filtradas",
          ]}
          button="ASSINAR PRO"
          onClick={() => window.open(PRO_LINK, "_blank")}
        />

        <Plan
          vip
          name="VIP"
          price="R$ 39,99"
          description="A experiência completa."
          items={[
            "Tudo do PRO",
            "Grupo VIP WhatsApp",
            "Áudios GREEN/RED",
            "Almost Green",
            "Alertas ao vivo",
            "Suporte prioritário",
          ]}
          button="ASSINAR VIP"
          onClick={() => window.open(VIP_LINK, "_blank")}
        />
      </section>
    </main>
  );
}

function Plan({
  name,
  price,
  description,
  items,
  button,
  onClick,
  featured,
  vip,
}: {
  name: string;
  price: string;
  description: string;
  items: string[];
  button: string;
  onClick: () => void;
  featured?: boolean;
  vip?: boolean;
}) {
  return (
    <div
      style={
        vip
          ? styles.cardVip
          : featured
          ? styles.cardPro
          : styles.card
      }
    >
      <span style={styles.name}>{name}</span>

      <strong style={styles.price}>{price}</strong>

      <p style={styles.description}>{description}</p>

      <div style={styles.items}>
        {items.map((item) => (
          <span key={item}>✅ {item}</span>
        ))}
      </div>

      <button
        style={vip ? styles.buttonVip : styles.button}
        onClick={onClick}
      >
        {button}
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#070014,#15072f,#2e1065)",
    color: "#fff",
    fontFamily: "Arial, sans-serif",
    padding: 28,
  },

  header: {
    maxWidth: 1280,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },

  logo: {
    width: 300,
    height: 90,
    objectFit: "contain",
  },

  backButton: {
    background: "rgba(255,255,255,.10)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 999,
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 900,
  },

  hero: {
    maxWidth: 900,
    margin: "60px auto 34px",
    textAlign: "center",
  },

  kicker: {
    color: "#facc15",
    fontWeight: 900,
    letterSpacing: 1.2,
  },

  grid: {
    maxWidth: 1280,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 18,
  },

  card: {
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 26,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 13,
  },

  cardPro: {
    background:
      "linear-gradient(145deg,rgba(124,58,237,.52),rgba(17,24,39,.88))",
    border: "1px solid rgba(168,85,247,.40)",
    borderRadius: 26,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 13,
  },

  cardVip: {
    background:
      "linear-gradient(145deg,rgba(250,204,21,.18),rgba(76,29,149,.86))",
    border: "1px solid rgba(250,204,21,.40)",
    borderRadius: 26,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 13,
  },

  name: {
    color: "#facc15",
    fontWeight: 900,
    fontSize: 18,
  },

  price: {
    fontSize: 42,
    fontWeight: 900,
  },

  description: {
    color: "#ddd6fe",
  },

  items: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 220,
    color: "#f8fafc",
  },

  button: {
    background: "#ffffff",
    color: "#111827",
    border: 0,
    borderRadius: 16,
    padding: 15,
    fontWeight: 900,
    cursor: "pointer",
    marginTop: "auto",
  },

  buttonVip: {
    background: "#22c55e",
    color: "#052e16",
    border: 0,
    borderRadius: 16,
    padding: 15,
    fontWeight: 900,
    cursor: "pointer",
    marginTop: "auto",
  },
};