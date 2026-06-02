"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../services/api";

const VIP_LINK = "https://chat.whatsapp.com/JQuwv77T1b8J6KMlXCEeRb";

type AuthMode = "login" | "register";

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("register");
  const [selectedPlan, setSelectedPlan] = useState<"Free" | "Pro" | "Vip">("Free");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("lucas@email.com");
  const [password, setPassword] = useState("123456");

  function openAuth(nextMode: AuthMode, plan: "Free" | "Pro" | "Vip" = "Free") {
    setMode(nextMode);
    setSelectedPlan(plan);
    setAuthOpen(true);
  }

  async function handleLogin() {
    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem(
        "token",
        response.data.access_token || response.data.token,
      );

      window.location.href = "/dashboard";
    } catch {
      alert("Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    try {
      if (!name || !email || !password) {
        alert("Preencha nome, email e senha.");
        return;
      }

      setLoading(true);

      const response = await api.post("/auth/register", {
        name,
        email,
        password,
      });

      localStorage.setItem(
        "token",
        response.data.access_token || response.data.token,
      );

      localStorage.setItem("oddix_plan", selectedPlan);

      if (selectedPlan === "Free") {
        window.location.href = "/dashboard";
        return;
      }

      window.location.href = "/plans";
    } catch {
      alert("Erro ao criar conta. Talvez esse email já exista.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logoBox}>
          <img src="/logo-oddix-horizontal.png" alt="ODDIX TIPSTER IA" style={styles.logo} />
        </div>

        <nav style={styles.nav}>
          <button style={styles.navButton} onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}>
            Planos
          </button>
          <button style={styles.navButton} onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}>
            Como funciona
          </button>
          <button style={styles.loginButton} onClick={() => openAuth("login")}>
            Entrar
          </button>
          <button style={styles.vipButton} onClick={() => openAuth("register", "Vip")}>
            Quero ser VIP
          </button>
        </nav>
      </header>

      <section style={styles.hero}>
        <div style={styles.heroText}>
          <span style={styles.kicker}>ODDIX TIPSTER IA</span>

          <h1 style={styles.title}>
            Palpites com IA, odds inteligentes e gestão de banca.
          </h1>

          <p style={styles.subtitle}>
            Primeiro você conhece a plataforma. Depois decide se quer entrar no Free,
            Pro ou VIP. O Oddix organiza jogos, mercados, estatísticas e oportunidades
            em tempo real.
          </p>

          <div style={styles.heroActions}>
            <button style={styles.primaryButton} onClick={() => openAuth("register", "Free")}>
              Entrar grátis no site
            </button>

            <button style={styles.secondaryButton} onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}>
              Ver planos
            </button>
          </div>

          <div style={styles.heroBadges}>
            <span>🤖 IA Premium</span>
            <span>📊 Odds e mercados</span>
            <span>🔴 Ao vivo</span>
            <span>💎 Grupo VIP</span>
          </div>
        </div>

        <div style={styles.heroPreview}>
          <div style={styles.appTop}>
            <img src="/logo-oddix-horizontal.png" alt="Oddix" style={styles.previewLogo} />
            <button style={styles.previewVip}>Assinar VIP</button>
          </div>

          <div style={styles.previewGrid}>
            <PreviewMetric label="Jogos" value="247" />
            <PreviewMetric label="Ao vivo" value="18" />
            <PreviewMetric label="Tips IA" value="10" />
            <PreviewMetric label="ROI" value="12.6%" />
          </div>

          <div style={styles.previewCard}>
            <div>
              <span style={styles.livePill}>🔴 AO VIVO</span>
              <h3>Palmeiras x Flamengo</h3>
              <p>Brasileirão Série A • Hoje 21:30</p>
            </div>

            <div style={styles.pickBox}>
              <small>Palpite IA</small>
              <strong>Ambas marcam — Sim</strong>
              <span>Odd 1.72 • Confiança 87%</span>
            </div>
          </div>

          <div style={styles.playerProps}>
            <strong>PLAYER PROPS</strong>
            <span>James Rodríguez +0.5 chute no gol</span>
            <b>Odd 1.85 • 87%</b>
          </div>
        </div>
      </section>

      <section id="como-funciona" style={styles.howSection}>
        <span style={styles.kicker}>COMO FUNCIONA</span>
        <h2 style={styles.sectionTitle}>Você entra, acompanha os jogos e escolhe o plano certo.</h2>

        <div style={styles.stepsGrid}>
          <StepCard icon="1" title="Veja o site primeiro" text="A pessoa entra no Oddix, entende os recursos e vê os jogos disponíveis." />
          <StepCard icon="2" title="Cria conta grátis" text="No Free ela acompanha jogos, rankings, odds e vitrine da IA." />
          <StepCard icon="3" title="Assina Pro ou VIP" text="No Pro libera análise. No VIP libera grupo, mentoria e melhores entradas." />
        </div>
      </section>

      <section id="planos" style={styles.plansSection}>
        <span style={styles.kicker}>PLANOS ODDIX</span>
        <h2 style={styles.sectionTitle}>Comece grátis. Evolua quando quiser.</h2>

        <div style={styles.plansGrid}>
          <PlanCard
            name="Free"
            price="R$ 0"
            description="Para conhecer o site."
            features={[
              "Acesso ao dashboard",
              "Jogos ao vivo e pré-jogo",
              "Odds e mercados básicos",
              "Ranking de qualidade",
              "Não vê análise completa da IA",
            ]}
            button="Começar grátis"
            onClick={() => openAuth("register", "Free")}
          />

          <PlanCard
            featured
            name="Pro"
            price="R$ 29,90"
            description="Para quem quer ver análise."
            features={[
              "Tudo do Free",
              "Ver análise completa da IA",
              "Mercados inteligentes",
              "Player Props",
              "Oddix Boost",
              "Sem grupo VIP e sem mentoria",
            ]}
            button="Quero ser Pro"
            onClick={() => openAuth("register", "Pro")}
          />

          <PlanCard
            vip
            name="VIP"
            price="R$ 59,90"
            description="Para quem quer sala completa."
            features={[
              "Tudo do Pro",
              "Grupo VIP no WhatsApp",
              "Mentoria de melhores palpites",
              "Gestão de banca",
              "Alertas ao vivo",
              "Prioridade nas melhores entradas",
            ]}
            button="Quero ser VIP"
            onClick={() => openAuth("register", "Vip")}
          />
        </div>
      </section>

      <section style={styles.ctaSection}>
        <div>
          <span style={styles.kicker}>SALA VIP</span>
          <h2 style={styles.ctaTitle}>Entre no grupo e receba chamadas da IA.</h2>
          <p style={styles.ctaText}>
            O VIP é para quem quer análise, melhores palpites, gestão de banca e acompanhamento mais próximo.
          </p>
        </div>

        <button style={styles.whatsappButton} onClick={() => window.open(VIP_LINK, "_blank")}>
          Entrar no WhatsApp
        </button>
      </section>

      <footer style={styles.footer}>
        <strong>ODDIX TIPSTER IA</strong>
        <span>Jogue com responsabilidade. O Oddix trabalha com análise e gestão, não promessa de lucro garantido.</span>
      </footer>

      {authOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.authBox}>
            <button style={styles.closeButton} onClick={() => setAuthOpen(false)}>
              ×
            </button>

            <img src="/logo-oddix-square.png" alt="Oddix" style={styles.authLogo} />

            <h2>{mode === "login" ? "Entrar no Oddix" : `Criar conta ${selectedPlan}`}</h2>
            <p style={styles.authSubtitle}>
              {mode === "login"
                ? "Acesse sua conta e continue acompanhando os jogos."
                : "Você pode começar no Free e mudar para Pro ou VIP depois."}
            </p>

            <div style={styles.authTabs}>
              <button style={mode === "login" ? styles.authTabActive : styles.authTab} onClick={() => setMode("login")}>
                Entrar
              </button>
              <button style={mode === "register" ? styles.authTabActive : styles.authTab} onClick={() => setMode("register")}>
                Criar conta
              </button>
            </div>

            {mode === "register" && (
              <input style={styles.input} placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
            )}

            <input style={styles.input} placeholder="Seu email" value={email} onChange={(e) => setEmail(e.target.value)} />

            <input style={styles.input} placeholder="Sua senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {mode === "register" && (
              <select style={styles.input} value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value as any)}>
                <option value="Free">Free — não vê análise completa</option>
                <option value="Pro">Pro — vê análise</option>
                <option value="Vip">VIP — análise + grupo + mentoria</option>
              </select>
            )}

            <button style={styles.authButton} disabled={loading} onClick={mode === "login" ? handleLogin : handleRegister}>
              {loading ? "Carregando..." : mode === "login" ? "Entrar" : "Criar minha conta"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.previewMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StepCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div style={styles.stepCard}>
      <span style={styles.stepIcon}>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function PlanCard({
  name,
  price,
  description,
  features,
  button,
  onClick,
  featured,
  vip,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  button: string;
  onClick: () => void;
  featured?: boolean;
  vip?: boolean;
}) {
  return (
    <div style={vip ? styles.planVip : featured ? styles.planFeatured : styles.planCard}>
      <span style={styles.planName}>{name}</span>
      <strong style={styles.planPrice}>{price}</strong>
      <p style={styles.planDescription}>{description}</p>

      <div style={styles.features}>
        {features.map((feature) => (
          <span key={feature}>✅ {feature}</span>
        ))}
      </div>

      <button style={vip ? styles.planButtonVip : styles.planButton} onClick={onClick}>
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
  },
  header: {
    height: 96,
    padding: "14px 30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(8,4,20,.78)",
    backdropFilter: "blur(18px)",
    borderBottom: "1px solid rgba(255,255,255,.08)",
  },
  logoBox: {
    width: 330,
    height: 74,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    filter: "drop-shadow(0 0 18px rgba(124,58,237,.60))",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  navButton: {
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.13)",
    borderRadius: 999,
    padding: "11px 15px",
    cursor: "pointer",
    fontWeight: 800,
  },
  loginButton: {
    background: "transparent",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.25)",
    borderRadius: 999,
    padding: "11px 18px",
    cursor: "pointer",
    fontWeight: 900,
  },
  vipButton: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 999,
    padding: "12px 19px",
    cursor: "pointer",
    fontWeight: 900,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 34,
    alignItems: "center",
    padding: "70px 34px 50px",
    maxWidth: 1380,
    margin: "0 auto",
  },
  heroText: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  kicker: {
    color: "#facc15",
    fontWeight: 900,
    letterSpacing: 1.3,
    fontSize: 13,
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: 58,
    lineHeight: 1.02,
    letterSpacing: -2,
  },
  subtitle: {
    margin: 0,
    color: "#ddd6fe",
    fontSize: 18,
    lineHeight: 1.6,
    maxWidth: 720,
  },
  heroActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  primaryButton: {
    background: "#22c55e",
    color: "#052e16",
    border: 0,
    borderRadius: 16,
    padding: "15px 20px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 16px 38px rgba(34,197,94,.26)",
  },
  secondaryButton: {
    background: "rgba(255,255,255,.09)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 16,
    padding: "15px 20px",
    fontWeight: 900,
    cursor: "pointer",
  },
  heroBadges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  heroPreview: {
    background: "linear-gradient(145deg,rgba(17,24,39,.96),rgba(76,29,149,.90))",
    border: "1px solid rgba(255,255,255,.13)",
    borderRadius: 34,
    padding: 22,
    boxShadow: "0 30px 80px rgba(0,0,0,.45)",
    transform: "rotate(-1deg)",
  },
  appTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  previewLogo: {
    width: 190,
    height: 62,
    objectFit: "contain",
  },
  previewVip: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 10,
    marginBottom: 16,
  },
  previewMetric: {
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  previewCard: {
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 22,
    padding: 18,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  livePill: {
    background: "#dc2626",
    color: "#fff",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  pickBox: {
    background: "rgba(0,0,0,.28)",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  playerProps: {
    marginTop: 14,
    background: "rgba(124,58,237,.22)",
    border: "1px solid rgba(168,85,247,.30)",
    borderRadius: 18,
    padding: 15,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  howSection: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "45px 34px",
  },
  sectionTitle: {
    fontSize: 38,
    margin: "10px 0 24px",
  },
  stepsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 18,
  },
  stepCard: {
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 24,
    padding: 22,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    background: "#7c3aed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },
  plansSection: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "45px 34px",
  },
  plansGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 18,
  },
  planCard: {
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 26,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 13,
  },
  planFeatured: {
    background: "linear-gradient(145deg,rgba(124,58,237,.52),rgba(17,24,39,.88))",
    border: "1px solid rgba(168,85,247,.40)",
    borderRadius: 26,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 13,
    boxShadow: "0 20px 55px rgba(124,58,237,.24)",
  },
  planVip: {
    background: "linear-gradient(145deg,rgba(250,204,21,.18),rgba(76,29,149,.86))",
    border: "1px solid rgba(250,204,21,.40)",
    borderRadius: 26,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 13,
    boxShadow: "0 20px 55px rgba(250,204,21,.16)",
  },
  planName: {
    color: "#facc15",
    fontWeight: 900,
    fontSize: 15,
  },
  planPrice: {
    fontSize: 36,
  },
  planDescription: {
    color: "#ddd6fe",
    margin: 0,
  },
  features: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    color: "#f8fafc",
    lineHeight: 1.45,
    minHeight: 190,
  },
  planButton: {
    background: "#fff",
    color: "#111827",
    border: 0,
    borderRadius: 16,
    padding: "14px 16px",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: "auto",
  },
  planButtonVip: {
    background: "#22c55e",
    color: "#052e16",
    border: 0,
    borderRadius: 16,
    padding: "14px 16px",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: "auto",
  },
  ctaSection: {
    maxWidth: 1280,
    margin: "30px auto 0",
    padding: "34px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    background: "linear-gradient(135deg,#111827,#4c1d95)",
    borderRadius: 30,
    border: "1px solid rgba(255,255,255,.12)",
  },
  ctaTitle: {
    fontSize: 34,
    margin: "8px 0",
  },
  ctaText: {
    color: "#ddd6fe",
    margin: 0,
  },
  whatsappButton: {
    background: "#22c55e",
    color: "#052e16",
    border: 0,
    borderRadius: 18,
    padding: "16px 22px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  footer: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "34px",
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    color: "#c4b5fd",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.72)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  authBox: {
    position: "relative",
    width: "100%",
    maxWidth: 480,
    background: "linear-gradient(145deg,#111827,#2e1065)",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 30,
    padding: 28,
    boxShadow: "0 30px 90px rgba(0,0,0,.55)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 999,
    border: 0,
    background: "rgba(255,255,255,.10)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 22,
  },
  authLogo: {
    width: 150,
    height: 110,
    objectFit: "contain",
    alignSelf: "center",
  },
  authSubtitle: {
    color: "#ddd6fe",
    marginTop: -8,
  },
  authTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  authTab: {
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 14,
    padding: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  authTabActive: {
    background: "#7c3aed",
    color: "#fff",
    border: 0,
    borderRadius: 14,
    padding: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  input: {
    width: "100%",
    background: "rgba(0,0,0,.35)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 15,
    padding: 15,
    outline: "none",
  },
  authButton: {
    width: "100%",
    background: "#22c55e",
    color: "#052e16",
    border: 0,
    borderRadius: 15,
    padding: 15,
    fontWeight: 900,
    cursor: "pointer",
  },
};
