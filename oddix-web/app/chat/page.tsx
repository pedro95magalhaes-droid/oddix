'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

type Suggestion = {
  icon: string;
  label: string;
  prompt: string;
};

type HistoryItem = {
  id: string;
  title: string;
  desc: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function OddixChatPage() {
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      id: 'top-picks',
      title: 'Top Picks de hoje',
      desc: 'Melhores entradas com confiança alta',
    },
    {
      id: 'live',
      title: 'Análise ao vivo',
      desc: 'Pressão, posse, finalizações e odds',
    },
    {
      id: 'multiple',
      title: 'Múltipla segura',
      desc: 'Bilhete com risco controlado',
    },
    {
      id: 'player-props',
      title: 'Player Props',
      desc: 'Jogadores com melhor tendência',
    },
  ];

  const hasConversation = messages.length > 0;

  const quickCards = useMemo(
    () => [
      ['🔥', 'Top Pick', 'Melhor entrada do dia com score Oddix.'],
      ['⚡', 'Ao Vivo', 'Pressão, momento e leitura em tempo real.'],
      ['📈', 'Mercado', 'Movimento de odds e value bets.'],
      ['🧠', 'Agents', 'Research, estatísticas, notícias e decisão final.'],
    ],
    [],
  );

  function buildFakeAnswer(prompt: string) {
    const lower = prompt.toLowerCase();

    if (lower.includes('múltipla') || lower.includes('multipla')) {
      return `🔥 **Múltipla segura Oddix**

Vou montar uma múltipla com foco em risco controlado.

**Estratégia sugerida:**
• evitar odds muito altas;
• priorizar mercados de dupla chance, over baixo e proteção;
• entrar somente em jogos com estatística real e boa leitura de mercado.

Para montar com jogos reais, me diga a data ou envie os jogos que você quer analisar.`;
    }

    if (lower.includes('quanto ganho') || lower.includes('r$')) {
      return `💰 **Calculadora Oddix**

Para calcular o retorno, preciso da odd.

Fórmula:
**Retorno = valor apostado × odd**

Exemplo:
• aposta: R$20
• odd: 1.80
• retorno: R$36
• lucro: R$16

Me mande a odd ou a múltipla que eu calculo certinho.`;
    }

    if (lower.includes('lesões') || lower.includes('desfalques')) {
      return `🚑 **Lesões e desfalques**

Vou verificar impacto de ausências no desempenho do time.

Pontos que a IA considera:
• jogador titular fora;
• impacto tático;
• substituto provável;
• queda ofensiva ou defensiva;
• notícias recentes.

Me diga o jogo ou time para análise completa.`;
    }

    if (lower.includes('mercado') || lower.includes('odds')) {
      return `📈 **Mercado e odds**

A análise de mercado considera:
• abertura da odd;
• queda ou subida brusca;
• possível value bet;
• volume de mercado;
• risco de armadilha.

Me envie o jogo para eu comparar tendência, odd atual e melhor mercado.`;
    }

    if (lower.includes('notícia') || lower.includes('noticias')) {
      return `📰 **Resumo de notícias**

O News Agent busca:
• escalações prováveis;
• desfalques;
• momento dos clubes;
• declarações recentes;
• impacto no mercado.

Me diga o jogo ou time que eu faço o resumo focado em apostas.`;
    }

    return `🧠 **Análise Oddix iniciada**

Entendi sua pergunta:

“${prompt}”

Para uma análise profissional, vou considerar:
• momento das equipes;
• estatísticas recentes;
• mando de campo;
• notícias e desfalques;
• tendência de mercado;
• valor da odd;
• risco da entrada.

Me envie o jogo específico ou clique em uma sugestão para continuar.`;
  }

  function sendMessage(customText?: string) {
    const text = (customText ?? message).trim();

    if (!text || isThinking) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    setMessages((current) => [...current, userMessage]);
    setMessage('');
    setIsThinking(true);

    window.setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: buildFakeAnswer(text),
      };

      setMessages((current) => [...current, assistantMessage]);
      setIsThinking(false);
    }, 850);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function handleSuggestion(prompt: string) {
    sendMessage(prompt);
  }

  function handleNewConversation() {
    setMessages([]);
    setMessage('');
    setIsThinking(false);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  function openHistory(item: HistoryItem) {
    const prompt = `${item.title}: ${item.desc}`;
    sendMessage(prompt);
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
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/70 hover:bg-white/10 md:hidden"
            >
              ✕
            </button>
          </div>

          <button
            type="button"
            onClick={handleNewConversation}
            className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-left text-sm font-black text-emerald-300 shadow-[0_0_25px_rgba(34,197,94,.12)] transition hover:bg-emerald-500/25"
          >
            + Nova conversa
          </button>

          <div className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-white/35">
            Histórico
          </div>

          <div className="space-y-2">
            {history.map((item, index) => (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => openHistory(item)}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.07 }}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-emerald-400/30 hover:bg-emerald-500/10"
              >
                <div className="text-sm font-black text-white/90">{item.title}</div>
                <div className="mt-1 text-[11px] text-white/45">{item.desc}</div>
              </motion.button>
            ))}
          </div>

          <div className="mt-auto rounded-2xl border border-emerald-400/20 bg-black/45 p-4">
            <div className="text-xs font-black text-emerald-300">Oddix Chat V7.6.3</div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/55">
              Botões ativos, sugestões funcionais e conversa simulada.
            </p>
          </div>
        </div>
      </aside>

      <button
        type="button"
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
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white/80 backdrop-blur-xl hover:bg-white/10"
            >
              ☰
            </button>

            <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300 shadow-[0_0_22px_rgba(34,197,94,.16)]">
              CHAT V7.6.3
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="hidden rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-semibold text-white/90 backdrop-blur-xl transition hover:bg-white/10 md:block"
            >
              ↺ Histórico
            </button>

            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="rounded-full border border-white/10 bg-black/25 px-4 py-3 text-white/80 backdrop-blur-xl transition hover:bg-white/10"
            >
              ⚙
            </button>

            <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-300">
              ● IA online
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-5 pb-8 pt-[4vh] text-center">
          {!hasConversation && (
            <>
              <motion.div
                initial={{ opacity: 0, y: -28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="mb-6 flex flex-col items-center"
              >
                <img
                  src="/images/oddix-logo-banner.png"
                  alt="Oddix"
                  className="w-[620px] max-w-[92vw] object-contain drop-shadow-[0_0_50px_rgba(34,197,94,.28)]"
                  draggable={false}
                />

                <p className="-mt-1 text-sm text-white/68 md:text-base">
                  Seu assistente inteligente para análise de futebol, odds e apostas.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  boxShadow: [
                    '0 0 16px rgba(34,197,94,.10)',
                    '0 0 42px rgba(34,197,94,.28)',
                    '0 0 16px rgba(34,197,94,.10)',
                  ],
                }}
                transition={{
                  opacity: { duration: 0.7, delay: 0.1 },
                  y: { duration: 0.7, delay: 0.1 },
                  boxShadow: {
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }}
                className="mb-6 w-full max-w-5xl rounded-3xl border border-emerald-400/25 bg-black/45 p-5 text-left shadow-[0_20px_80px_rgba(0,0,0,.45),0_0_42px_rgba(34,197,94,.10)] backdrop-blur-2xl"
              >
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
              </motion.div>
            </>
          )}

          {hasConversation && (
            <div className="mb-6 flex w-full max-w-5xl flex-1 flex-col gap-4 rounded-3xl border border-white/10 bg-black/42 p-4 text-left shadow-[0_20px_80px_rgba(0,0,0,.45)] backdrop-blur-2xl">
              {messages.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={[
                    'max-w-[88%] rounded-3xl px-5 py-4 text-sm leading-relaxed md:text-base',
                    item.role === 'user'
                      ? 'ml-auto bg-emerald-500/20 text-white'
                      : 'mr-auto border border-white/10 bg-white/[0.06] text-white/82',
                  ].join(' ')}
                >
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                    {item.role === 'user' ? 'Você' : 'Oddix IA'}
                  </div>

                  <div className="whitespace-pre-line">{item.content}</div>
                </motion.div>
              ))}

              {isThinking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mr-auto rounded-3xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white/70"
                >
                  <span className="text-emerald-300">Oddix IA</span> analisando...
                </motion.div>
              )}
            </div>
          )}

          <motion.form
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18 }}
            onSubmit={handleSubmit}
            className="flex w-full max-w-5xl items-center gap-3 rounded-full border border-emerald-400/25 bg-[#0d141d]/88 px-5 py-4 shadow-[0_30px_100px_rgba(0,0,0,.65),0_0_45px_rgba(34,197,94,.15)] backdrop-blur-3xl transition focus-within:border-emerald-400/60 md:px-7 md:py-5"
          >
            <button
              type="button"
              onClick={handleNewConversation}
              className="text-2xl text-white/80 hover:text-emerald-300"
              title="Nova conversa"
            >
              +
            </button>

            <input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Pergunte sobre jogos, times, estatísticas, palpites, múltiplas..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/42 md:text-base"
            />

            <button
              type="button"
              onClick={() => setMessage('Quero uma análise por voz do melhor jogo de hoje.')}
              className="hidden text-xl text-white/85 hover:text-emerald-300 sm:block"
              title="Comando por voz"
            >
              🎙️
            </button>

            <button
              type="button"
              onClick={() => setMessage('Ajuste a análise para risco baixo e odd máxima 2.00.')}
              className="hidden text-xl text-white/85 hover:text-emerald-300 sm:block"
              title="Preferências"
            >
              🎚️
            </button>

            <button
              type="submit"
              disabled={isThinking}
              className="rounded-full bg-emerald-500/20 px-4 py-3 text-xs font-black text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50 md:px-6"
            >
              {isThinking ? 'Analisando...' : '✨ Modo IA'}
            </button>
          </motion.form>

          {!hasConversation && (
            <>
              <div className="mt-7 w-full max-w-5xl">
                <p className="mb-4 text-sm text-white/65">Sugestões rápidas</p>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {suggestions.map((item, index) => (
                    <motion.button
                      key={item.label}
                      type="button"
                      initial={{ opacity: 0, y: 22 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.24 + index * 0.06 }}
                      onClick={() => handleSuggestion(item.prompt)}
                      className="group rounded-2xl border border-white/10 bg-black/35 p-3 text-left shadow-[0_14px_35px_rgba(0,0,0,.25)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-emerald-500/10"
                    >
                      <div className="mb-2 text-xl">{item.icon}</div>
                      <div className="text-sm font-black text-white/90">{item.label}</div>
                      <div className="mt-1 line-clamp-2 text-[11px] text-white/45 group-hover:text-white/65">
                        {item.prompt}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid w-full max-w-5xl grid-cols-1 gap-3 md:grid-cols-4">
                {quickCards.map((item, index) => (
                  <motion.button
                    key={item[1]}
                    type="button"
                    onClick={() => sendMessage(`${item[1]}: ${item[2]}`)}
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 + index * 0.08 }}
                    className="rounded-3xl border border-emerald-400/20 bg-black/40 p-4 text-left backdrop-blur-xl transition hover:-translate-y-1 hover:bg-emerald-500/10"
                  >
                    <div className="text-xl">{item[0]}</div>
                    <div className="mt-2 text-sm font-black">{item[1]}</div>
                    <p className="mt-1 text-[11px] text-white/50">{item[2]}</p>
                  </motion.button>
                ))}
              </div>
            </>
          )}

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-8 w-full max-w-6xl rounded-2xl border border-white/10 bg-black/58 px-5 py-4 text-center text-sm text-white/65 shadow-[0_20px_80px_rgba(0,0,0,.55)] backdrop-blur-xl"
          >
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
          </motion.div>
        </div>
      </section>
    </main>
  );
}