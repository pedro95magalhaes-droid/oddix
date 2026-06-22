'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  prompt: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type OddixApiResponse = {
  answer?: string;
  message?: string;
  response?: string;
  text?: string;
  result?: string;
};

export default function OddixChatPage() {
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [apiStatus, setApiStatus] = useState('verificando');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_ODDIX_API_URL;
  const hasConversation = messages.length > 0;

  const suggestions: Suggestion[] = [
    {
      icon: '🎯',
      label: 'Analisar jogo',
      prompt: 'Analise o melhor jogo de hoje com estatísticas, notícias, odds e tendência.',
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
      prompt: 'Mostre os Top Picks de hoje com score, risco e justificativa.',
    },
    {
      id: 'live',
      title: 'Análise ao vivo',
      desc: 'Pressão, posse, finalizações e odds',
      prompt: 'Analise jogos ao vivo com pressão, posse, finalizações, escanteios e odds.',
    },
    {
      id: 'multiple',
      title: 'Múltipla segura',
      desc: 'Bilhete com risco controlado',
      prompt: 'Monte uma múltipla segura com odds baixas e risco controlado.',
    },
    {
      id: 'player-props',
      title: 'Player Props',
      desc: 'Jogadores com melhor tendência',
      prompt: 'Mostre Player Props com boa tendência, chutes e finalizações.',
    },
  ];

  const quickCards = useMemo(
    () => [
      ['🔥', 'Top Pick', 'Qual é o Top Pick do dia com maior confiança?'],
      ['⚡', 'Ao Vivo', 'Analise os jogos ao vivo agora.'],
      ['📈', 'Mercado', 'Mostre movimento de odds e value bets.'],
      ['🧠', 'Agents', 'Explique a análise usando os agents Oddix.'],
    ],
    [],
  );

  useEffect(() => {
    if (!apiBase) {
      setApiConnected(false);
      setApiStatus('sem env');
      return;
    }

    setApiConnected(true);
    setApiStatus('api configurada');
  }, [apiBase]);

  useEffect(() => {
    if (!chatScrollRef.current) return;

    chatScrollRef.current.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isThinking]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) setSidebarOpen(true);
      if (window.innerWidth < 1024) setSidebarOpen(false);
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function getLastUserContext() {
    const lastUserMessage = [...messages].reverse().find((item) => item.role === 'user');
    return lastUserMessage?.content ?? '';
  }

  function extractOddAndStake(text: string) {
    const stakeMatch = text.match(/r\$\s?(\d+(?:[,.]\d+)?)/i);
    const oddMatch =
      text.match(/odd\s?(\d+(?:[,.]\d+)?)/i) ||
      text.match(/@?\s(\d+[,.]\d{2})/i);

    const stake = stakeMatch ? Number(stakeMatch[1].replace(',', '.')) : null;
    const odd = oddMatch ? Number(oddMatch[1].replace(',', '.')) : null;

    if (!stake || !odd) return null;

    return {
      stake,
      odd,
      retorno: stake * odd,
      lucro: stake * odd - stake,
    };
  }

  function buildSmartFallback(prompt: string) {
    const lower = prompt.toLowerCase();
    const lastContext = getLastUserContext();
    const calc = extractOddAndStake(prompt);

    if (calc) {
      return `💰 **Calculadora Oddix**

Valor apostado: **R$${calc.stake.toFixed(2)}**
Odd: **${calc.odd.toFixed(2)}**

Retorno total: **R$${calc.retorno.toFixed(2)}**
Lucro estimado: **R$${calc.lucro.toFixed(2)}**

✅ Fórmula usada:
**Retorno = valor apostado × odd**

⚠️ Lembrete: retorno não é garantia. Aposte com responsabilidade.`;
    }

    if (
      lower.includes('esse jogo') ||
      lower.includes('essa partida') ||
      lower.includes('continua') ||
      lower.includes('outra opção') ||
      lower.includes('mais segura') ||
      lower.includes('mais agressiva')
    ) {
      return `🧠 **Contexto entendido**

Você está continuando a conversa anterior.

Último contexto identificado:
**${lastContext || 'nenhum jogo específico encontrado ainda'}**

Posso seguir com:
• análise mais conservadora;
• análise mais agressiva;
• melhor mercado;
• risco da entrada;
• cálculo de retorno;
• alternativa de múltipla.`;
    }

    if (lower.includes('múltipla') || lower.includes('multipla')) {
      return `🔥 **Múltipla segura Oddix**

Estratégia ideal para múltipla:

1. Evitar odds muito altas
2. Priorizar mercados protegidos
3. Usar jogos com estatística real
4. Não misturar muitos riscos
5. Evitar jogo sem informação confiável

Modelo seguro:
• Dupla chance
• Over 0.5 gols
• Over 1.5 gols
• Time marca 1+ gol
• Handicap +1.5`;
    }

    if (lower.includes('top pick') || lower.includes('melhores palpites') || lower.includes('palpites')) {
      return `🏆 **Top Picks Oddix**

Para um Top Pick profissional, a IA avalia:

• forma recente dos times;
• mando de campo;
• gols marcados e sofridos;
• lesões e desfalques;
• notícias recentes;
• movimento das odds;
• valor real da entrada;
• risco x confiança.

✅ Regra Oddix:
**sem dados reais suficientes = sem entrada**`;
    }

    if (lower.includes('mercado') || lower.includes('odds') || lower.includes('value')) {
      return `📈 **Mercado e Value Bet**

A leitura do mercado considera:

• odd de abertura;
• odd atual;
• queda brusca;
• subida suspeita;
• possível entrada de dinheiro;
• valor escondido;
• risco de armadilha.

💎 Uma value bet acontece quando a probabilidade real parece maior que a probabilidade indicada pela odd.`;
    }

    if (lower.includes('lesões') || lower.includes('desfalques')) {
      return `🚑 **Lesões e Desfalques**

O impacto é medido por:

• titular fora;
• posição do jogador;
• substituto provável;
• perda ofensiva;
• perda defensiva;
• impacto tático;
• notícias recentes.

Um atacante titular fora muda mercado de gols.
Um zagueiro titular fora pode aumentar chance de BTTS/Over.`;
    }

    if (lower.includes('notícia') || lower.includes('noticias')) {
      return `📰 **News Agent Oddix**

Resumo focado em apostas:

• notícias recentes;
• escalações prováveis;
• desfalques;
• clima interno;
• declarações de treinador;
• calendário e desgaste;
• impacto nas odds.`;
    }

    if (lower.includes('ao vivo') || lower.includes('live')) {
      return `⚡ **Análise ao vivo Oddix**

No live, a IA prioriza:

• pressão ofensiva;
• finalizações;
• chutes no gol;
• escanteios;
• posse perigosa;
• ataques recentes;
• odd subindo ou caindo;
• minuto do jogo.

Mercados possíveis:
• próximo gol;
• over gols;
• escanteios;
• dupla chance live.`;
    }

    return `🧠 **Análise Oddix iniciada**

Entendi sua pergunta:

**${prompt}**

Para uma análise profissional, vou avaliar:

• momento das equipes;
• estatísticas recentes;
• mando de campo;
• notícias e desfalques;
• tendência de mercado;
• valor da odd;
• risco da entrada;
• confiança final.

✅ Me envie um jogo específico, por exemplo:
**Flamengo x Palmeiras**

Ou pergunte:
**quanto ganho com R$20 na odd 1.85?**`;
  }

  async function callOddixApi(prompt: string) {
    if (!apiBase) {
      console.warn('NEXT_PUBLIC_ODDIX_API_URL não configurada.');
      return null;
    }

    const cleanApiBase = apiBase.replace(/\/$/, '');
    const endpoint = `${cleanApiBase}/chat-football/message`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          question: prompt,
          messages,
          context: {
            source: 'oddix-web-chat',
            version: 'V9-responsive',
          },
        }),
      });

      if (!response.ok) {
        setApiStatus(`erro ${response.status}`);
        return null;
      }

      const data = (await response.json()) as OddixApiResponse;

      const answer =
        data.answer ||
        data.response ||
        data.message ||
        data.text ||
        data.result;

      if (answer) {
        setApiConnected(true);
        setApiStatus('api online');
        return answer;
      }

      setApiStatus('sem resposta');
      return null;
    } catch (error) {
      console.warn('Falha na Oddix API:', error);
      setApiConnected(false);
      setApiStatus('falha na api');
      return null;
    }
  }

  async function sendMessage(customText?: string) {
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

    if (window.innerWidth < 1024) setSidebarOpen(false);

    const apiAnswer = await callOddixApi(text);

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: apiAnswer || buildSmartFallback(text),
    };

    setMessages((current) => [...current, assistantMessage]);
    setIsThinking(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function handleNewConversation() {
    setMessages([]);
    setMessage('');
    setIsThinking(false);

    if (window.innerWidth < 1024) setSidebarOpen(false);

    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <main className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#02070d] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/oddix-chat-bg.png')" }}
      />

      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,.20),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,7,13,.15),rgba(2,7,13,.42)_50%,rgba(2,7,13,.95))]" />

      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/55 lg:hidden"
          aria-label="Fechar menu"
        />
      )}

      <div className="relative z-10 flex h-full min-h-0 w-full overflow-hidden">
        <aside
          className={[
            'fixed left-0 top-0 z-40 h-[100dvh] w-[260px] max-w-[84vw] border-r border-white/10 bg-black/75 backdrop-blur-2xl transition-transform duration-300 lg:relative lg:z-10 lg:h-full lg:translate-x-0 lg:bg-black/62',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="flex h-full min-h-0 flex-col p-3 sm:p-4">
            <div className="mb-5 flex shrink-0 items-center justify-between">
              <img
                src="/images/oddix-logo.png"
                alt="Oddix"
                className="h-6 w-auto object-contain sm:h-7"
                draggable={false}
              />

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/70 hover:bg-white/10 lg:hidden"
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              onClick={handleNewConversation}
              className="mb-4 shrink-0 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-left text-sm font-black text-emerald-300 hover:bg-emerald-500/25"
            >
              + Nova conversa
            </button>

            <div className="mb-3 shrink-0 text-xs font-black uppercase tracking-[0.22em] text-white/35">
              Histórico
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {history.map((item, index) => (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => sendMessage(item.prompt)}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left hover:border-emerald-400/30 hover:bg-emerald-500/10"
                >
                  <div className="text-sm font-black text-white/90">{item.title}</div>
                  <div className="mt-1 text-[11px] text-white/45">{item.desc}</div>
                </motion.button>
              ))}
            </div>

            <div className="mt-4 shrink-0 rounded-2xl border border-emerald-400/20 bg-black/45 p-4">
              <div className="text-xs font-black text-emerald-300">Oddix Chat V9</div>
              <p className="mt-2 text-[11px] leading-relaxed text-white/55">
                Chat responsivo. Status: {apiStatus}
              </p>
            </div>
          </div>
        </aside>

        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-[58px] shrink-0 items-center justify-between gap-2 px-3 sm:h-[64px] md:h-[72px] md:px-5 xl:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white/80 backdrop-blur-xl hover:bg-white/10"
              >
                ☰
              </button>

              <span className="truncate rounded-lg border border-emerald-400/20 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300 md:px-3 md:text-xs">
                CHAT V9
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2 md:gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="hidden rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-semibold text-white/90 backdrop-blur-xl hover:bg-white/10 lg:block"
              >
                ↺ Histórico
              </button>

              <div
                className={[
                  'rounded-full border px-3 py-2 text-[10px] font-black md:px-4 md:text-xs',
                  apiConnected
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-yellow-400/20 bg-yellow-500/10 text-yellow-300',
                ].join(' ')}
              >
                {apiConnected ? '● API online' : '● API offline'}
              </div>
            </div>
          </header>

          <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col items-center overflow-hidden px-3 pb-3 sm:px-4 md:px-5 md:pb-5">
            {!hasConversation && (
              <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden py-2 md:py-4">
                <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center">
                  <motion.img
                    src="/images/oddix-logo-banner.png"
                    alt="Oddix"
                    initial={{ opacity: 0, y: -24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="w-full max-w-[330px] object-contain drop-shadow-[0_0_50px_rgba(34,197,94,.28)] sm:max-w-[420px] md:max-w-[560px]"
                    draggable={false}
                  />

                  <p className="mt-2 max-w-[92vw] text-center text-xs text-white/68 md:text-base">
                    Seu assistente inteligente para análise de futebol, odds e apostas.
                  </p>

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
                    className="mt-4 w-full rounded-2xl border border-emerald-400/25 bg-black/45 p-3 text-left backdrop-blur-2xl md:mt-6 md:rounded-3xl md:p-5"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 md:text-xs">
                          Destaque principal
                        </div>
                        <h2 className="mt-1 text-lg font-black text-white md:text-2xl">
                          🔥 Top Pick do Dia
                        </h2>
                      </div>

                      <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-2 text-[10px] font-black text-emerald-300 md:px-4 md:text-xs">
                        Score Oddix 88%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4 xl:gap-3">
                      {['Análise automática', 'Melhor entrada', 'Risco controlado', '19 Agents ativos'].map(
                        (item) => (
                          <div
                            key={item}
                            className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 md:p-3"
                          >
                            <div className="text-[11px] font-black md:text-sm">{item}</div>
                          </div>
                        ),
                      )}
                    </div>
                  </motion.div>

                  <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:mt-6 xl:grid-cols-4 xl:gap-3">
                    {suggestions.map((item, index) => (
                      <motion.button
                        key={item.label}
                        type="button"
                        onClick={() => sendMessage(item.prompt)}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + index * 0.04 }}
                        className="rounded-2xl border border-white/10 bg-black/35 p-3 text-left backdrop-blur-xl hover:border-emerald-400/40 hover:bg-emerald-500/10"
                      >
                        <div className="mb-1 text-lg md:mb-2 md:text-xl">{item.icon}</div>
                        <div className="text-sm font-black text-white/90">{item.label}</div>
                        <div className="mt-1 line-clamp-2 text-[11px] text-white/45">
                          {item.prompt}
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:mt-5 xl:grid-cols-4 xl:gap-3">
                    {quickCards.map((item, index) => (
                      <motion.button
                        key={item[1]}
                        type="button"
                        onClick={() => sendMessage(item[2])}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 + index * 0.05 }}
                        className="rounded-2xl border border-emerald-400/20 bg-black/40 p-3 text-left backdrop-blur-xl hover:bg-emerald-500/10 md:rounded-3xl md:p-4"
                      >
                        <div className="text-lg md:text-xl">{item[0]}</div>
                        <div className="mt-1 text-sm font-black md:mt-2">{item[1]}</div>
                        <p className="mt-1 text-[11px] text-white/50">{item[2]}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {hasConversation && (
              <div
                ref={chatScrollRef}
                className="flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-black/42 p-3 text-left backdrop-blur-2xl md:gap-4 md:rounded-3xl md:p-4"
              >
                {messages.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={[
                      'max-w-[94%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[88%] md:rounded-3xl md:px-5 md:py-4 md:text-base',
                      item.role === 'user'
                        ? 'ml-auto bg-emerald-500/20 text-white'
                        : 'mr-auto border border-white/10 bg-white/[0.06] text-white/85',
                    ].join(' ')}
                  >
                    <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300 md:text-xs">
                      {item.role === 'user' ? 'Você' : 'Oddix IA'}
                    </div>
                    <div className="whitespace-pre-line">{item.content}</div>
                  </motion.div>
                ))}

                {isThinking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mr-auto rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/70 md:rounded-3xl md:px-5 md:py-4"
                  >
                    <span className="text-emerald-300">Oddix IA</span> analisando...
                  </motion.div>
                )}
              </div>
            )}

            <motion.form
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              onSubmit={handleSubmit}
              className="mt-3 flex w-full max-w-5xl shrink-0 items-center gap-2 rounded-2xl border border-emerald-400/30 bg-[#0d141d]/92 px-3 py-3 shadow-[0_30px_100px_rgba(0,0,0,.65),0_0_45px_rgba(34,197,94,.15)] backdrop-blur-3xl focus-within:border-emerald-400/60 md:mt-4 md:gap-3 md:rounded-full md:px-7 md:py-4"
            >
              <button
                type="button"
                onClick={handleNewConversation}
                className="text-xl text-white/80 hover:text-emerald-300 md:text-2xl"
                title="Nova conversa"
              >
                +
              </button>

              <input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Pergunte sobre jogos, odds, estatísticas..."
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/42 md:text-base"
              />

              <button
                type="button"
                onClick={() => setMessage('Ajuste a análise para risco baixo e odd máxima 2.00.')}
                className="hidden text-xl text-white/85 hover:text-emerald-300 sm:block"
              >
                🎚️
              </button>

              <button
                type="submit"
                disabled={isThinking}
                className="rounded-full bg-emerald-500/20 px-3 py-2.5 text-[10px] font-black text-emerald-300 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50 md:px-6 md:py-3 md:text-xs"
              >
                {isThinking ? 'Analisando...' : '✨ IA'}
              </button>
            </motion.form>

            <div className="mt-2 w-full max-w-5xl shrink-0 rounded-2xl border border-white/10 bg-black/50 px-4 py-2 text-center text-[10px] text-white/60 backdrop-blur-xl md:mt-3 md:px-5 md:py-3 md:text-xs">
              🛡️ Oddix Chat pode cometer erros. Confirme as informações antes de apostar.
              <span className="ml-1 font-black text-emerald-400">+18</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
