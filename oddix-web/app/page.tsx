"use client";

import { useState } from "react";
import { api } from "../services/api";

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/chat");
}

const VIP_LINK = "https://chat.whatsapp.com/JQuwv77T1b8J6KMlXCEeRb";

type AuthMode = "login" | "register";
type Plan = "Free" | "Pro" | "Vip";

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("register");
  const [selectedPlan, setSelectedPlan] = useState<Plan>("Free");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("lucas@email.com");
  const [password, setPassword] = useState("123456");

  function openAuth(nextMode: AuthMode, plan: Plan = "Free") {
    setMode(nextMode);
    setSelectedPlan(plan);
    setAuthOpen(true);
  }

  async function handleLogin() {
    try {
      setLoading(true);

      const response = await api.post("/auth/login", { email, password });

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
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#070014,#15072f,#2e1065)] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080414]/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-center sm:justify-start">
            <img
              src="/logo-oddix-horizontal.png"
              alt="ODDIX TIPSTER IA"
              className="h-14 w-auto max-w-[220px] object-contain drop-shadow-[0_0_18px_rgba(124,58,237,.65)] sm:h-16 sm:max-w-[260px]"
            />
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            <button
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-extrabold text-white"
              onClick={() =>
                document
                  .getElementById("como-funciona")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Como funciona
            </button>

            <button
              className="rounded-full border border-white/25 bg-transparent px-4 py-2 text-sm font-black text-white"
              onClick={() => openAuth("login")}
            >
              Entrar
            </button>

            <button
              className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-black text-slate-950"
              onClick={() => openAuth("register", "Vip")}
            >
              Quero ser VIP
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-5">
          <span className="text-sm font-black uppercase tracking-[0.2em] text-yellow-400">
            ODDIX TIPSTER IA
          </span>

          <h1 className="m-0 text-4xl font-black leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            Palpites com IA, odds inteligentes e gestão de banca.
          </h1>

          <p className="max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
            Primeiro você conhece a plataforma. Depois decide se quer entrar no
            Free, Pro ou VIP. O Oddix organiza jogos, mercados, estatísticas e
            oportunidades em tempo real.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="rounded-2xl bg-green-500 px-5 py-4 font-black text-green-950 shadow-[0_16px_38px_rgba(34,197,94,.26)]"
              onClick={() => openAuth("register", "Free")}
            >
              Entrar grátis no site
            </button>

            <button
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 font-black text-white"
              onClick={() =>
                document
                  .getElementById("planos")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Ver planos
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-sm font-bold text-white/90">
            <span className="rounded-full bg-white/10 px-3 py-2">🤖 IA Premium</span>
            <span className="rounded-full bg-white/10 px-3 py-2">📊 Odds e mercados</span>
            <span className="rounded-full bg-white/10 px-3 py-2">🔴 Ao vivo</span>
            <span className="rounded-full bg-white/10 px-3 py-2">💎 Grupo VIP</span>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/15 bg-[linear-gradient(145deg,rgba(17,24,39,.96),rgba(76,29,149,.90))] p-5 shadow-[0_30px_80px_rgba(0,0,0,.45)] lg:rotate-[-1deg]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <img
              src="/logo-oddix-horizontal.png"
              alt="Oddix"
              className="h-14 w-auto max-w-[170px] object-contain"
            />

            <button className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-black text-slate-950">
              Assinar VIP
            </button>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PreviewMetric label="Jogos" value="247" />
            <PreviewMetric label="Ao vivo" value="18" />
            <PreviewMetric label="Tips IA" value="10" />
            <PreviewMetric label="ROI" value="12.6%" />
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-3xl border border-white/10 bg-white/10 p-4 sm:grid-cols-2">
            <div>
              <span className="rounded-full bg-red-600 px-3 py-2 text-xs font-black">
                🔴 AO VIVO
              </span>
              <h3 className="mt-4 text-xl font-black">Palmeiras x Flamengo</h3>
              <p className="text-sm text-violet-100">
                Brasileirão Série A • Hoje 21:30
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl bg-black/30 p-4">
              <small className="text-violet-200">Palpite IA</small>
              <strong>Ambas marcam — Sim</strong>
              <span className="text-sm text-violet-100">
                Odd 1.72 • Confiança 87%
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-purple-400/30 bg-purple-600/20 p-4">
            <strong>PLAYER PROPS</strong>
            <span>James Rodríguez +0.5 chute no gol</span>
            <b>Odd 1.85 • 87%</b>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <span className="text-sm font-black uppercase tracking-[0.2em] text-yellow-400">
          COMO FUNCIONA
        </span>

        <h2 className="mt-3 max-w-4xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
          Você entra, acompanha os jogos e escolhe o plano certo.
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StepCard
            icon="1"
            title="Veja o site primeiro"
            text="A pessoa entra no Oddix, entende os recursos e vê os jogos disponíveis."
          />

          <StepCard
            icon="2"
            title="Cria conta grátis"
            text="No Free ela acompanha jogos, rankings, odds e vitrine da IA."
          />

          <StepCard
            icon="3"
            title="Assina Pro ou VIP"
            text="No Pro libera análise. No VIP libera grupo, mentoria e melhores entradas."
          />
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <span className="text-sm font-black uppercase tracking-[0.2em] text-yellow-400">
          PLANOS ODDIX
        </span>

        <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
          Comece grátis. Evolua quando quiser.
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
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

      <section className="mx-4 mt-8 flex max-w-7xl flex-col gap-5 rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#111827,#4c1d95)] p-6 sm:mx-6 lg:mx-auto lg:flex-row lg:items-center lg:justify-between lg:p-9">
        <div>
          <span className="text-sm font-black uppercase tracking-[0.2em] text-yellow-400">
            SALA VIP
          </span>

          <h2 className="mt-2 text-3xl font-black sm:text-4xl">
            Entre no grupo e receba chamadas da IA.
          </h2>

          <p className="mt-3 max-w-3xl text-violet-100">
            O VIP é para quem quer análise, melhores palpites, gestão de banca e
            acompanhamento mais próximo.
          </p>
        </div>

        <button
          className="w-full rounded-2xl bg-green-500 px-6 py-4 font-black text-green-950 lg:w-auto"
          onClick={() => window.open(VIP_LINK, "_blank")}
        >
          Entrar no WhatsApp
        </button>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-10 text-violet-200 sm:px-6 lg:px-8">
        <strong>ODDIX TIPSTER IA</strong>
        <span>
          Jogue com responsabilidade. O Oddix trabalha com análise e gestão, não
          promessa de lucro garantido.
        </span>
      </footer>

      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="relative flex w-full max-w-lg flex-col gap-3 rounded-[2rem] border border-white/15 bg-[linear-gradient(145deg,#111827,#2e1065)] p-6 shadow-[0_30px_90px_rgba(0,0,0,.55)]">
            <button
              className="absolute right-4 top-4 h-10 w-10 rounded-full bg-white/10 text-2xl text-white"
              onClick={() => setAuthOpen(false)}
            >
              ×
            </button>

            <img
              src="/logo-oddix-square.png"
              alt="Oddix"
              className="mx-auto h-28 w-36 object-contain"
            />

            <h2 className="text-2xl font-black">
              {mode === "login" ? "Entrar no Oddix" : `Criar conta ${selectedPlan}`}
            </h2>

            <p className="text-violet-100">
              {mode === "login"
                ? "Acesse sua conta e continue acompanhando os jogos."
                : "Você pode começar no Free e mudar para Pro ou VIP depois."}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                className={
                  mode === "login"
                    ? "rounded-2xl bg-purple-600 p-3 font-black text-white"
                    : "rounded-2xl border border-white/10 bg-white/10 p-3 font-extrabold text-white"
                }
                onClick={() => setMode("login")}
              >
                Entrar
              </button>

              <button
                className={
                  mode === "register"
                    ? "rounded-2xl bg-purple-600 p-3 font-black text-white"
                    : "rounded-2xl border border-white/10 bg-white/10 p-3 font-extrabold text-white"
                }
                onClick={() => setMode("register")}
              >
                Criar conta
              </button>
            </div>

            {mode === "register" && (
              <input
                className="w-full rounded-2xl border border-white/15 bg-black/35 p-4 text-white outline-none"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}

            <input
              className="w-full rounded-2xl border border-white/15 bg-black/35 p-4 text-white outline-none"
              placeholder="Seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="w-full rounded-2xl border border-white/15 bg-black/35 p-4 text-white outline-none"
              placeholder="Sua senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {mode === "register" && (
              <select
                className="w-full rounded-2xl border border-white/15 bg-black/35 p-4 text-white outline-none"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value as Plan)}
              >
                <option value="Free">Free — não vê análise completa</option>
                <option value="Pro">Pro — vê análise</option>
                <option value="Vip">VIP — análise + grupo + mentoria</option>
              </select>
            )}

            <button
              className="w-full rounded-2xl bg-green-500 p-4 font-black text-green-950"
              disabled={loading}
              onClick={mode === "login" ? handleLogin : handleRegister}
            >
              {loading
                ? "Carregando..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar minha conta"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/10 p-3">
      <span className="text-xs text-violet-100">{label}</span>
      <strong className="text-xl">{value}</strong>
    </div>
  );
}

function StepCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[1.7rem] border border-white/10 bg-white/10 p-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600 text-xl font-black">
        {icon}
      </span>

      <h3 className="mt-5 text-2xl font-black">{title}</h3>
      <p className="mt-3 text-lg leading-7 text-violet-100">{text}</p>
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
  const cardClass = vip
    ? "rounded-[1.8rem] border border-yellow-300/40 bg-[linear-gradient(145deg,rgba(250,204,21,.18),rgba(76,29,149,.86))] p-6 shadow-[0_20px_55px_rgba(250,204,21,.16)]"
    : featured
      ? "rounded-[1.8rem] border border-purple-400/40 bg-[linear-gradient(145deg,rgba(124,58,237,.52),rgba(17,24,39,.88))] p-6 shadow-[0_20px_55px_rgba(124,58,237,.24)]"
      : "rounded-[1.8rem] border border-white/10 bg-white/10 p-6";

  return (
    <div className={`${cardClass} flex min-h-full flex-col gap-4`}>
      <span className="text-sm font-black text-yellow-400">{name}</span>

      <strong className="text-4xl font-black">{price}</strong>

      <p className="text-violet-100">{description}</p>

      <div className="flex flex-col gap-3 text-sm leading-6 text-slate-50 sm:text-base">
        {features.map((feature) => (
          <span key={feature}>✅ {feature}</span>
        ))}
      </div>

      <button
        className={
          vip
            ? "mt-auto rounded-2xl bg-green-500 px-5 py-4 font-black text-green-950"
            : "mt-auto rounded-2xl bg-white px-5 py-4 font-black text-slate-950"
        }
        onClick={onClick}
      >
        {button}
      </button>
    </div>
  );
}