'use client';

import { useState } from 'react';
import {
  ArrowDown,
  BarChart3,
  ChevronDown,
  Crosshair,
  Gem,
  History,
  Layers,
  Mic,
  Newspaper,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TrendingUp,
  Trophy,
} from 'lucide-react';

export default function OddixChatPage() {
  const [message, setMessage] = useState('');

  const suggestions = [
    { icon: Crosshair, label: 'Analisar jogo' },
    { icon: Trophy, label: 'Melhores palpites' },
    { icon: BarChart3, label: 'Estatísticas' },
    { icon: ShieldCheck, label: 'Lesões e desfalques' },
    { icon: Newspaper, label: 'Últimas notícias' },
    { icon: TrendingUp, label: 'Mercado movimento' },
    { icon: Gem, label: 'Value Bets' },
    { icon: Layers, label: 'Múltiplas' },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02070d] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/oddix-chat-bg.png')" }}
      />

      <div className="absolute inset-0 bg-[rgba(2,7,13,0.42)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,.12),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,7,13,.1),rgba(2,7,13,.22)_45%,rgba(2,7,13,.74)_82%,rgba(2,7,13,.96))]" />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:90px_90px]" />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-8">
        <div className="flex items-center gap-4">
          <img
            src="/images/oddix-logo.png"
            alt="Oddix"
            className="h-8 w-auto object-contain md:h-10"
          />

          <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300 shadow-[0_0_22px_rgba(34,197,94,.16)]">
            CHAT V7.5
          </span>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <button className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-semibold text-white/90 backdrop-blur-xl transition hover:bg-white/10 md:flex">
            <History size={17} />
            Histórico
          </button>

          <button className="rounded-full p-3 text-white/80 transition hover:bg-white/10">
            <Sun size={19} />
          </button>

          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-xl">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-black">
              <img
                src="/images/oddix-logo-icon.png"
                alt="Oddix"
                className="h-7 w-7 object-contain"
              />
            </div>
            <ChevronDown size={16} className="text-white/70" />
          </button>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-6xl flex-col items-center px-5 pb-8 pt-[12vh] text-center">
        <div className="mb-10 flex flex-col items-center">
          <img
            src="/images/oddix-logo.png"
            alt="Oddix"
            className="w-[420px] max-w-[80vw] object-contain drop-shadow-[0_0_35px_rgba(255,255,255,.25)]"
          />

          <p className="mt-4 text-lg text-white/80 md:text-xl">
            Seu Guia Inteligente de{' '}
            <span className="font-bold text-emerald-400">Apostas</span>
          </p>
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex w-full max-w-5xl items-center gap-4 rounded-full border border-emerald-400/20 bg-[#0d141d]/85 px-5 py-4 shadow-[0_30px_100px_rgba(0,0,0,.65),0_0_45px_rgba(34,197,94,.12)] backdrop-blur-3xl transition focus-within:border-emerald-400/55 md:px-7 md:py-5"
        >
          <button type="button" className="text-white/80 transition hover:text-emerald-300">
            <Plus size={25} />
          </button>

          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Pergunte sobre jogos, times, estatísticas, palpites..."
            className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/42 md:text-lg"
          />

          <button type="button" className="hidden text-white/85 transition hover:text-emerald-300 sm:block">
            <Mic size={23} />
          </button>

          <button type="button" className="hidden text-white/85 transition hover:text-emerald-300 sm:block">
            <SlidersHorizontal size={23} />
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/30 md:px-6 md:text-base"
          >
            <Sparkles size={18} />
            Modo IA
          </button>
        </form>

        <div className="mt-10">
          <p className="mb-6 text-sm text-white/65">Sugestões rápidas</p>

          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
            {suggestions.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  className="flex items-center justify-center gap-3 rounded-full border border-white/10 bg-black/35 px-5 py-4 text-sm font-semibold text-white/90 shadow-[0_14px_35px_rgba(0,0,0,.25)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-emerald-400/35 hover:bg-emerald-400/10"
                >
                  <Icon size={17} className="text-emerald-300" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto hidden flex-col items-center gap-3 md:flex">
          <button className="grid h-14 w-14 place-items-center rounded-full border border-emerald-400/25 bg-[#07120d]/90 text-emerald-400 shadow-[0_0_35px_rgba(34,197,94,.28)]">
            <ArrowDown size={25} />
          </button>
          <span className="text-sm text-white/80">Role para explorar</span>
        </div>

        <div className="mt-7 w-full max-w-7xl rounded-2xl border border-white/10 bg-black/58 px-5 py-4 text-center text-sm text-white/65 shadow-[0_20px_80px_rgba(0,0,0,.55)] backdrop-blur-xl">
          <div className="flex flex-col items-center justify-center gap-2 md:flex-row">
            <ShieldCheck size={20} className="text-emerald-400" />
            <span>
              Oddix Chat pode cometer erros. Sempre confirme as informações antes de apostar.
            </span>
          </div>

          <p className="mt-2">
            Jogue com responsabilidade.{' '}
            <span className="font-bold text-emerald-400">+18</span>
          </p>
        </div>
      </section>
    </main>
  );
}