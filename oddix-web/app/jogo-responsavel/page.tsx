'use client';

import Image from 'next/image';

const guidance = [
  ['18+', 'O conteúdo da Oddix é destinado exclusivamente a maiores de 18 anos.'],
  ['Apostas envolvem risco', 'Não existe garantia de lucro, mesmo quando há estatísticas, odds ou análise avançada.'],
  ['Não é investimento', 'Aposta deve ser tratada como entretenimento, nunca como renda, salário ou solução financeira.'],
  ['Controle de banca', 'Defina limites de valor, frequência e tempo antes de apostar.'],
  ['Não recupere perdas', 'Evite aumentar valores para tentar recuperar prejuízos anteriores.'],
  ['Use plataformas autorizadas', 'Prefira operadores regulados, com ferramentas de controle, suporte e autoexclusão.'],
];

export default function JogoResponsavelPage() {
  return (
    <main className="min-h-screen bg-[#06070b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(245,158,11,.10),transparent_26%),radial-gradient(circle_at_90%_0%,rgba(99,102,241,.10),transparent_24%),linear-gradient(180deg,#06070b,#04050a)]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/7 pb-5">
          <a href="/chat" className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-amber-300/15 bg-white/[0.04]">
              <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={52} height={52} className="h-11 w-11 object-contain" priority />
            </span>
            <div>
              <span className="block text-[11px] font-black uppercase tracking-[0.34em] text-amber-300">Oddix</span>
              <span className="mt-1 block text-sm text-white/55">Jogo Responsável</span>
            </div>
          </a>

          <div className="flex gap-3">
            <a href="/dashboard" className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-bold text-white/72 hover:bg-white/[0.06]">Dashboard</a>
            <a href="/chat" className="rounded-full border border-amber-300/18 bg-amber-400/8 px-4 py-2.5 text-sm font-bold text-amber-200 hover:bg-amber-400/12">Abrir chat</a>
          </div>
        </header>

        <div className="grid flex-1 items-start gap-8 py-10 lg:grid-cols-[.95fr_1.05fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/18 bg-amber-400/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">
              18+ • Aposte com cuidado
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">
              Jogo é entretenimento. Controle vem antes de qualquer aposta.
            </h1>

            <p className="mt-5 text-base leading-8 text-white/62">
              A Oddix fornece conteúdo informativo, estatístico e analítico. Nenhuma análise, odd ou previsão elimina o risco financeiro. Use limites, faça pausas e nunca aposte valores que comprometam sua vida pessoal.
            </p>

            <div className="mt-8 rounded-[28px] border border-amber-300/14 bg-amber-400/8 p-5">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-200">Aviso principal</p>
              <p className="mt-3 text-sm leading-7 text-white/70">
                Proibido para menores de 18 anos. Apostas podem causar perdas financeiras. Não use apostas como investimento, fonte de renda, solução de dívidas ou tentativa de recuperar prejuízos.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {guidance.map(([title, desc]) => (
              <div key={title} className="rounded-[24px] border border-white/10 bg-[rgba(12,15,22,.82)] p-5">
                <p className="text-sm font-black text-white">{title}</p>
                <p className="mt-3 text-sm leading-7 text-white/56">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="mb-8 rounded-[30px] border border-white/10 bg-[rgba(12,15,22,.82)] p-6">
          <h2 className="text-2xl font-semibold">Sinais de alerta</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              'Apostar para tentar recuperar perdas.',
              'Mentir ou esconder valores apostados.',
              'Usar dinheiro de contas essenciais.',
              'Aumentar valores por impulso.',
              'Perder controle de tempo ou frequência.',
              'Sentir ansiedade, culpa ou irritação após apostar.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-rose-300/12 bg-rose-400/7 p-4 text-sm leading-6 text-white/68">
                {item}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
