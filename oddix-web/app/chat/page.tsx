'use client';

import { useState } from 'react';

type Suggestion = {
  icon: string;
  label: string;
  prompt: string;
};

type HistoryItem = {
  title: string;
  desc: string;
};

export default function OddixChatPage() {
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const suggestions: Suggestion[] = [
    {
      icon: '🎯',
      label: 'Analisar jogo',
      prompt: 'Analise o melhor jogo de hoje com estatísticas, notícias e tendência.',
    },
    {
      icon: '🏆',
      label: 'Top Picks',
      prompt: 'Mostre os melhores palpites de hoje com alta confiança.',
    },
    {
      icon: '📊',
      label: 'Estatísticas',
      prompt: 'Compare estatísticas recentes dos times.',
    },
    {
      icon: '🚑',
      label: 'Lesões',
      prompt: 'Mostre lesões, desfalques e impacto no jogo.',
    },
    {
      icon: '📰',
      label: 'Notícias',
      prompt: 'Resuma as últimas notícias importantes para apostas.',
    },
    {
      icon: '📈',
      label: 'Mercado',
      prompt: 'Analise movimento de odds e possíveis value bets.',
    },
    {
      icon: '💎',
      label: 'Value Bets',
      prompt: 'Encontre value bets com boa odd e risco controlado.',
    },
    {
      icon: '🔥',
      label: 'Múltipla',
      prompt: 'Monte uma múltipla segura para hoje.',
    },
  ];

  const history: HistoryItem[] = [
    {
      title: 'Top Picks de hoje',
      desc: 'Melhores entradas com confiança alta',
    },
    {
      title: 'Análise ao vivo',
      desc: 'Pressão, posse, finalizações e odds',
    },
    {
      title: 'Múltipla segura',
      desc: 'Bilhete com risco controlado',
    },
    {
      title: 'Player Props',
      desc: 'Jogadores com melhor tendência',
    },
  ];

  function handleSuggestion(prompt: string) {
    setMessage(prompt);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02070d] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/oddix-chat-bg.png')" }}
      />

      <div className="absolute inset-0 bg-black/48" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,.22),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,7,13,.12),rgba(2,7,13,.35)_50%,rgba(2,7,13,.92))]" />
      <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:90px_90px]" />

      <aside
        className={[
          'fixed left-0 top-0 z-30 h-screen w-[260px] border-r border-white/10 bg-black/58 backdrop-blur-2xl transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-5 flex items-center justify-between">
            <img
              src="/images/oddix-logo.png"
              alt="Oddix"
              className="h-7 w-auto object-contain"
              draggable={false}
            />

            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/70 hover:bg-white/10 md:hidden"
            >
              ✕
            </button>
          </div>

          <button className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-left text-sm font-black text-emerald-300 shadow-[0_0_25px_rgba(34,197,94,.12)] transition hover:bg-emerald-500/25">
            + Nova conversa
          </button>

          <div className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-white/35">
            Histórico
          </div>

          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item.title}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-emerald-400/30 hover:bg-emerald-500/10"
              >
                <div className="text-sm font-black text-white/90">{item.title}</div>
                <div className="mt-1 text-[11px] text-white/45">{item.desc}</div>
              </button>
            ))}
          </div>

          <div className="mt-auto rounded-2xl border border-emerald-400/20 bg-black/45 p-4">
            <div className="text-xs font-black text-emerald-300">Oddix Chat V7.6.1</div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/55">
              IA com research, agents avançados e análise inteligente para apostas.
            </p>
          </div>
        </div>
      </aside>

      <button
        onClick={() => setSidebarOpen(true)}
        className={[
          'fixed left-4 top-5 z-40 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-lg backdrop-blur-xl transition hover:bg-white/10',
          sidebarOpen ? 'hidden' : 'block',
        ].join(' ')}
      >
        ☰
      </button>

      <section
        className={[
          'relative z-10 flex min-h-screen flex-col transition-all duration-300',
          sidebarOpen ? 'md:pl-[260px]' : 'pl-0',
        ].join(' ')}
      >
        <header className="flex items-center justify-between px-5 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white/80 backdrop-blur-xl hover:bg-white/10"
            >
              ☰
            </button>

            <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300 shadow-[0_0_22px_rgba(34,197,94,.16)]">
              CHAT V7.6.1
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button className="hidden rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-semibold text-white/90 backdrop-blur-xl transition hover:bg-white/10 md:block">
              ↺ Histórico
            </button>

            <button className="rounded-full border border-white/10 bg-black/25 px-4 py-3 text-white/80 backdrop-blur-xl transition hover:bg-white/10">
              ⚙
            </button>

            <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-300">
              ● IA online
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-5 pb-8 pt-[4vh] text-center">
          <div className="mb-6 flex flex-col items-center">
            <img
              src="/images/oddix-logo-banner.png"
              alt="Oddix"
              className="w-[620px] max-w-[92vw] object-contain drop-shadow-[0_0_50px_rgba(34,197,94,.28)]"
              draggable={false}
            />

            <p className="-mt-1 text-sm text-white/68 md:text-base">
              Seu assistente inteligente para análise de futebol, odds e apostas.
            </p>
          </div>

          <div className="mb-6 w-full max-w-5xl rounded-3xl border border-emerald-400/25 bg-black/45 p-5 text-left shadow-[0_20px_80px_rgba(0,0,0,.45),0_0_42px_rgba(34,197,94,.10)] backdrop-blur-2xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                  Destaque principal
                </div>
                <h2 className="mt-1 text-xl font-black text-white md:text-2xl">
                  🔥 Top Pick do Dia
                </h2>
              </div>

              <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-4 py-2 text-xs font-black text-emerald-300">
                Score Oddix 88%
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[11px] text-white/45">Jogo</div>
                <div className="mt-1 text-sm font-black">Análise automática</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[11px] text-white/45">Mercado</div>
                <div className="mt-1 text-sm font-black">Melhor entrada</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[11px] text-white/45">Risco</div>
                <div className="mt-1 text-sm font-black text-emerald-300">Controlado</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[11px] text-white/45">IA</div>
                <div className="mt-1 text-sm font-black">19 Agents ativos</div>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex w-full max-w-5xl items-center gap-3 rounded-full border border-emerald-400/25 bg-[#0d141d]/88 px-5 py-4 shadow-[0_30px_100px_rgba(0,0,0,.65),0_0_45px_rgba(34,197,94,.15)] backdrop-blur-3xl transition focus-within:border-emerald-400/60 md:px-7 md:py-5"
          >
            <button type="button" className="text-2xl text-white/80 hover:text-emerald-300">
              +
            </button>

            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Pergunte sobre jogos, times, estatísticas, palpites, múltiplas..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/42 md:text-base"
            />

            <button type="button" className="hidden text-xl text-white/85 hover:text-emerald-300 sm:block">
              🎙️
            </button>

            <button type="button" className="hidden text-xl text-white/85 hover:text-emerald-300 sm:block">
              🎚️
            </button>

            <button
              type="submit"
              className="rounded-full bg-emerald-500/20 px-4 py-3 text-xs font-black text-emerald-300 transition hover:bg-emerald-500/30 md:px-6"
            >
              ✨ Modo IA
            </button>
          </form>

          <div className="mt-7 w-full max-w-5xl">
            <p className="mb-4 text-sm text-white/65">Sugestões rápidas</p>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {suggestions.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleSuggestion(item.prompt)}
                  className="group rounded-2xl border border-white/10 bg-black/35 p-3 text-left shadow-[0_14px_35px_rgba(0,0,0,.25)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-emerald-500/10"
                >
                  <div className="mb-2 text-xl">{item.icon}</div>
                  <div className="text-sm font-black text-white/90">{item.label}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-white/45 group-hover:text-white/65">
                    {item.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid w-full max-w-5xl grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-3xl border border-emerald-400/20 bg-black/40 p-4 text-left backdrop-blur-xl">
              <div className="text-xl">🔥</div>
              <div className="mt-2 text-sm font-black">Top Pick</div>
              <p className="mt-1 text-[11px] text-white/50">Melhor entrada do dia com score Oddix.</p>
            </div>

            <div className="rounded-3xl border border-emerald-400/20 bg-black/40 p-4 text-left backdrop-blur-xl">
              <div className="text-xl">⚡</div>
              <div className="mt-2 text-sm font-black">Ao Vivo</div>
              <p className="mt-1 text-[11px] text-white/50">Pressão, momento e leitura em tempo real.</p>
            </div>

            <div className="rounded-3xl border border-emerald-400/20 bg-black/40 p-4 text-left backdrop-blur-xl">
              <div className="text-xl">📈</div>
              <div className="mt-2 text-sm font-black">Mercado</div>
              <p className="mt-1 text-[11px] text-white/50">Movimento de odds e value bets.</p>
            </div>

            <div className="rounded-3xl border border-emerald-400/20 bg-black/40 p-4 text-left backdrop-blur-xl">
              <div className="text-xl">🧠</div>
              <div className="mt-2 text-sm font-black">Agents</div>
              <p className="mt-1 text-[11px] text-white/50">Research, estatísticas, notícias e decisão final.</p>
            </div>
          </div>

          <div className="mt-8 w-full max-w-6xl rounded-2xl border border-white/10 bg-black/58 px-5 py-4 text-center text-sm text-white/65 shadow-[0_20px_80px_rgba(0,0,0,.55)] backdrop-blur-xl">
            <div className="flex flex-col items-center justify-center gap-2 md:flex-row">
              <span className="text-emerald-400">🛡️</span>
              <span>
                Oddix Chat pode cometer erros. Sempre confirme as informações antes de apostar.
              </span>
            </div>

            <p className="mt-2">
              Jogue com responsabilidade.{' '}
              <span className="font-black text-emerald-400">+18</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}