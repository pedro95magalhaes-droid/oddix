"use client";

import type { CSSProperties } from "react";

const VIP_LINK = "https://chat.whatsapp.com/JQuwv77T1b8J6KMlXCEeRb";

export default function PlansPage() {
  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <img src="/logo-oddix-horizontal.png" alt="Oddix" style={styles.logo} />
        <button style={styles.backButton} onClick={() => (window.location.href = "/dashboard")}>
          Voltar ao dashboard
        </button>
      </header>

      <section style={styles.hero}>
        <span style={styles.kicker}>PLANOS ODDIX</span>
        <h1>Escolha o nível certo para sua banca.</h1>
        <p>
          Free acompanha a plataforma. Pro libera análise. VIP libera grupo,
          mentoria e acompanhamento para melhores palpites e gestão de banca.
        </p>
      </section>

      <section style={styles.grid}>
        <Plan
          name="Free"
          price="R$ 0"
          description="Para conhecer a plataforma."
          items={[
            "Dashboard de jogos",
            "Ao vivo e pré-jogo",
            "Ranking de qualidade",
            "Odds básicas",
            "Sem análise completa",
          ]}
          button="Continuar Free"
          onClick={() => (window.location.href = "/dashboard")}
        />

        <Plan
          featured
          name="Pro"
          price="R$ 29,90"
          description="Para liberar análise."
          items={[
            "Tudo do Free",
            "Análise completa da IA",
            "Mercados inteligentes",
            "Player Props",
            "Oddix Boost",
            "Sem grupo VIP",
          ]}
          button="Assinar Pro"
          onClick={() => alert("Em breve: checkout Pro. Por enquanto fale pelo WhatsApp.")}
        />

        <Plan
          vip
          name="VIP"
          price="R$ 59,90"
          description="Para sala completa."
          items={[
            "Tudo do Pro",
            "Grupo VIP no WhatsApp",
            "Mentoria de melhores palpites",
            "Gestão de banca",
            "Alertas ao vivo",
            "Suporte prioritário",
          ]}
          button="Entrar no VIP"
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
    <div style={vip ? styles.cardVip : featured ? styles.cardPro : styles.card}>
      <span style={styles.name}>{name}</span>
      <strong style={styles.price}>{price}</strong>
      <p style={styles.description}>{description}</p>

      <div style={styles.items}>
        {items.map((item) => (
          <span key={item}>✅ {item}</span>
        ))}
      </div>

      <button style={vip ? styles.buttonVip : styles.button} onClick={onClick}>
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
    background: "linear-gradient(145deg,rgba(124,58,237,.52),rgba(17,24,39,.88))",
    border: "1px solid rgba(168,85,247,.40)",
    borderRadius: 26,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 13,
  },
  cardVip: {
    background: "linear-gradient(145deg,rgba(250,204,21,.18),rgba(76,29,149,.86))",
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
  },
  price: {
    fontSize: 36,
  },
  description: {
    color: "#ddd6fe",
  },
  items: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 210,
    color: "#f8fafc",
  },
  button: {
    background: "#fff",
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
