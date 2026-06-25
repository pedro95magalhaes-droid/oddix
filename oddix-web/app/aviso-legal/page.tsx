'use client';

import Image from 'next/image';

export default function AvisoLegalPage() {
  return (
    <main className="min-h-screen bg-[#06070b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(245,158,11,.10),transparent_26%),radial-gradient(circle_at_90%_0%,rgba(99,102,241,.10),transparent_24%),linear-gradient(180deg,#06070b,#04050a)]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/7 pb-5">
          <a href="/chat" className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-amber-300/15 bg-white/[0.04]">
              <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={52} height={52} className="h-11 w-11 object-contain" priority />
            </span>
            <div>
              <span className="block text-[11px] font-black uppercase tracking-[0.34em] text-amber-300">Oddix</span>
              <span className="mt-1 block text-sm text-white/55">Aviso legal</span>
            </div>
          </a>
          <a href="/jogo-responsavel" className="rounded-full border border-amber-300/18 bg-amber-400/8 px-4 py-2.5 text-sm font-bold text-amber-200 hover:bg-amber-400/12">Jogo Responsável</a>
        </header>

        <article className="py-10">
          <div className="inline-flex rounded-full border border-amber-300/18 bg-amber-400/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">
            Transparência e afiliados
          </div>

          <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">Aviso legal da Oddix</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/62">
            A Oddix é uma plataforma de análise, informação e organização de dados para usuários maiores de 18 anos. O conteúdo publicado não representa garantia de lucro, promessa de resultado ou recomendação financeira personalizada.
          </p>

          <div className="mt-8 grid gap-5">
            {[
              ['Conteúdo informativo', 'As análises usam dados, odds, mercado e contexto quando disponíveis. Mesmo assim, eventos esportivos são incertos e podem gerar perdas.'],
              ['Risco financeiro', 'Apostas envolvem risco. Não aposte dinheiro destinado a aluguel, alimentação, saúde, transporte, estudos ou contas essenciais.'],
              ['Afiliados', 'A Oddix pode receber comissão de parceiros afiliados quando um usuário se cadastra por links indicados. Isso não altera o custo para o usuário.'],
              ['Sem promessa de lucro', 'Nenhuma estratégia, IA, odd ou análise elimina risco ou garante resultado positivo.'],
              ['Maiores de idade', 'Todo conteúdo é destinado exclusivamente a maiores de 18 anos.'],
              ['Operadores autorizados', 'Recomendamos que o usuário verifique se a plataforma de aposta opera de forma autorizada e oferece ferramentas de controle, suporte e autoexclusão.'],
            ].map(([title, desc]) => (
              <section key={title} className="rounded-[24px] border border-white/10 bg-[rgba(12,15,22,.82)] p-5">
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/60">{desc}</p>
              </section>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
