'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { MarkdownMessage } from '../../components/chat/MarkdownMessage';
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

type ChatHistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isFavorite?: boolean;
  createdAt?: string;
};

type ChatSession = {
  id: string;
  title?: string | null;
  isPinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
  messages?: ChatHistoryMessage[];
};

export default function OddixChatPage() {
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [apiStatus, setApiStatus] = useState('verificando');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_ODDIX_API_URL;
  const cleanApiBase = apiBase?.replace(/\/$/, '') ?? '';
  const historyApi = cleanApiBase ? `${cleanApiBase}/chat-history` : '';
  const hasConversation = Array.isArray(messages) && messages.some((item) => item?.content?.trim().length > 0);
  const showSidebarLabels = sidebarOpen || mobileSidebarOpen;
  const userId = 'demo-user';

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

  const fallbackHistory: HistoryItem[] = [
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
      ['🔥', 'Top Pick', 'Qual entrada tem maior confiança hoje?'],
      ['⚡', 'Live Pro', 'Analise pressão, finalizações e odds ao vivo.'],
      ['📈', 'Value Bet', 'Onde existe valor escondido no mercado hoje?'],
      ['🧠', 'Oddix Agents', 'Explique a decisão usando os agentes Oddix.'],
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
    if (!historyApi) return;
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyApi]);

  useEffect(() => {
    if (!chatScrollRef.current) return;

    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, [messages, isThinking]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, Math.max(120, window.innerHeight * 0.3))}px`;
  }, [message]);

  function closeMobileSidebar() {
    setMobileSidebarOpen(false);
  }

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
      return `💰 **Calculadora Oddix**\n\nValor apostado: **R$${calc.stake.toFixed(2)}**\nOdd: **${calc.odd.toFixed(2)}**\n\nRetorno total: **R$${calc.retorno.toFixed(2)}**\nLucro estimado: **R$${calc.lucro.toFixed(2)}**\n\n✅ Fórmula usada:\n**Retorno = valor apostado × odd**\n\n⚠️ Lembrete: retorno não é garantia. Aposte com responsabilidade.`;
    }

    if (
      lower.includes('esse jogo') ||
      lower.includes('essa partida') ||
      lower.includes('continua') ||
      lower.includes('outra opção') ||
      lower.includes('mais segura') ||
      lower.includes('mais agressiva')
    ) {
      return `🧠 **Contexto entendido**\n\nVocê está continuando a conversa anterior.\n\nÚltimo contexto identificado:\n**${lastContext || 'nenhum jogo específico encontrado ainda'}**\n\nPosso seguir com:\n• análise mais conservadora;\n• análise mais agressiva;\n• melhor mercado;\n• risco da entrada;\n• cálculo de retorno;\n• alternativa de múltipla.`;
    }

    if (lower.includes('múltipla') || lower.includes('multipla')) {
      return `🔥 **Múltipla segura Oddix**\n\nEstratégia ideal para múltipla:\n\n1. Evitar odds muito altas\n2. Priorizar mercados protegidos\n3. Usar jogos com estatística real\n4. Não misturar muitos riscos\n5. Evitar jogo sem informação confiável\n\nModelo seguro:\n• Dupla chance\n• Over 0.5 gols\n• Over 1.5 gols\n• Time marca 1+ gol\n• Handicap +1.5`;
    }

    if (lower.includes('top pick') || lower.includes('melhores palpites') || lower.includes('palpites')) {
      return `🏆 **Top Picks Oddix**\n\nPara um Top Pick profissional, a IA avalia:\n\n• forma recente dos times;\n• mando de campo;\n• gols marcados e sofridos;\n• lesões e desfalques;\n• notícias recentes;\n• movimento das odds;\n• valor real da entrada;\n• risco x confiança.\n\n✅ Regra Oddix:\n**sem dados reais suficientes = sem entrada**`;
    }

    if (lower.includes('mercado') || lower.includes('odds') || lower.includes('value')) {
      return `📈 **Mercado e Value Bet**\n\nA leitura do mercado considera:\n\n• odd de abertura;\n• odd atual;\n• queda brusca;\n• subida suspeita;\n• possível entrada de dinheiro;\n• valor escondido;\n• risco de armadilha.\n\n💎 Uma value bet acontece quando a probabilidade real parece maior que a probabilidade indicada pela odd.`;
    }

    if (lower.includes('lesões') || lower.includes('desfalques')) {
      return `🚑 **Lesões e Desfalques**\n\nO impacto é medido por:\n\n• titular fora;\n• posição do jogador;\n• substituto provável;\n• perda ofensiva;\n• perda defensiva;\n• impacto tático;\n• notícias recentes.\n\nUm atacante titular fora muda mercado de gols.\nUm zagueiro titular fora pode aumentar chance de BTTS/Over.`;
    }

    if (lower.includes('notícia') || lower.includes('noticias')) {
      return `📰 **News Agent Oddix**\n\nResumo focado em apostas:\n\n• notícias recentes;\n• escalações prováveis;\n• desfalques;\n• clima interno;\n• declarações de treinador;\n• calendário e desgaste;\n• impacto nas odds.`;
    }

    if (lower.includes('ao vivo') || lower.includes('live')) {
      return `⚡ **Análise ao vivo Oddix**\n\nNo live, a IA prioriza:\n\n• pressão ofensiva;\n• finalizações;\n• chutes no gol;\n• escanteios;\n• posse perigosa;\n• ataques recentes;\n• odd subindo ou caindo;\n• minuto do jogo.\n\nMercados possíveis:\n• próximo gol;\n• over gols;\n• escanteios;\n• dupla chance live.`;
    }

    return `🧠 **Análise Oddix iniciada**\n\nEntendi sua pergunta:\n\n**${prompt}**\n\nPara uma análise profissional, vou avaliar:\n\n• momento das equipes;\n• estatísticas recentes;\n• mando de campo;\n• notícias e desfalques;\n• tendência de mercado;\n• valor da odd;\n• risco da entrada;\n• confiança final.\n\n✅ Me envie um jogo específico, por exemplo:\n**Flamengo x Palmeiras**\n\nOu pergunte:\n**quanto ganho com R$20 na odd 1.85?**`;
  }

  async function loadSessions() {
    if (!historyApi) return;

    try {
      setHistoryLoading(true);

      const response = await fetch(`${historyApi}/sessions`, {
        headers: {
          'x-user-id': userId,
        },
      });

      if (!response.ok) return;

      const data = (await response.json()) as ChatSession[];
      setChatSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Falha ao carregar sessões:', error);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function createSession(title = 'Nova conversa') {
    if (!historyApi) return null;

    try {
      const response = await fetch(`${historyApi}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as ChatSession;
      setSessionId(data.id);
      await loadSessions();

      return data;
    } catch (error) {
      console.warn('Falha ao criar sessão:', error);
      return null;
    }
  }

  async function openSession(id: string) {
    if (!historyApi) return;

    try {
      setHistoryLoading(true);
      closeMobileSidebar();

      const response = await fetch(`${historyApi}/sessions/${id}`, {
        headers: {
          'x-user-id': userId,
        },
      });

      if (!response.ok) return;

      const data = (await response.json()) as ChatSession;
      const loadedMessages = (data.messages ?? []).map((item) => ({
        id: item.id,
        role: item.role,
        content: item.content,
      }));

      setSessionId(data.id);
      setMessages(loadedMessages);
    } catch (error) {
      console.warn('Falha ao abrir sessão:', error);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveMessage(currentSessionId: string, role: 'user' | 'assistant', content: string) {
    if (!historyApi || !currentSessionId || !content.trim()) return null;

    try {
      const response = await fetch(`${historyApi}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          role,
          content,
        }),
      });

      if (!response.ok) return null;

      return (await response.json()) as ChatHistoryMessage;
    } catch (error) {
      console.warn('Falha ao salvar mensagem:', error);
      return null;
    }
  }

  async function deleteSession(id: string) {
    if (!historyApi) return;

    try {
      await fetch(`${historyApi}/sessions/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId,
        },
      });

      if (sessionId === id) {
        setSessionId(null);
        setMessages([]);
      }

      await loadSessions();
    } catch (error) {
      console.warn('Falha ao excluir sessão:', error);
    }
  }

  async function callOddixApi(prompt: string) {
    if (!apiBase) {
      console.warn('NEXT_PUBLIC_ODDIX_API_URL não configurada.');
      return null;
    }

    const endpoint = `${cleanApiBase}/chat-football/message`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          question: prompt,
          sessionId: sessionId || 'oddix-web-session',
          conversationId: sessionId || 'oddix-web-session',
          chatId: sessionId || 'oddix-web-session',
          messages,
          history: messages,
          version: 'v17',
          context: {
            source: 'oddix-web-chat',
            version: 'V17-worldcup-resolver',
            sessionId: sessionId || 'oddix-web-session',
          },
        }),
      });

      if (!response.ok) {
        setApiStatus(`erro ${response.status}`);
        return null;
      }

      const data = (await response.json()) as OddixApiResponse;
      const answer = data.answer || data.response || data.message || data.text || data.result;

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

    let currentSessionId = sessionId;

    if (!currentSessionId) {
      const newSession = await createSession(text.slice(0, 60) || 'Nova conversa');
      currentSessionId = newSession?.id ?? null;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    setMessages((current) => [...current, userMessage]);
    setMessage('');
    setIsThinking(true);
    closeMobileSidebar();

    if (currentSessionId) {
      await saveMessage(currentSessionId, 'user', text);
    }

    const apiAnswer = await callOddixApi(text);
    const finalAnswer = apiAnswer || buildSmartFallback(text);

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: finalAnswer,
    };

    setMessages((current) => [...current, assistantMessage]);

    if (currentSessionId) {
      await saveMessage(currentSessionId, 'assistant', finalAnswer);
      await loadSessions();
    }

    setIsThinking(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function handleNewConversation() {
    setSessionId(null);
    setMessages([]);
    setMessage('');
    setIsThinking(false);
    closeMobileSidebar();
    window.setTimeout(() => textareaRef.current?.focus(), 60);
  }

  function getSessionTitle(item: ChatSession) {
    return item.title?.trim() || item.messages?.[0]?.content?.slice(0, 44) || 'Nova conversa';
  }

  function getSessionDesc(item: ChatSession) {
    const lastMessage = item.messages?.[0];
    if (lastMessage?.content) return lastMessage.content.slice(0, 54);
    if (item.updatedAt) return new Date(item.updatedAt).toLocaleString('pt-BR');
    return 'Histórico Oddix';
  }

  return (
    <main className="oddix-chat-root h-dvh w-screen overflow-hidden bg-[var(--oddix-bg)] text-[#ecfff7] [--header-height:52px] [--sidebar-width:260px] [--sidebar-rail-width:72px] [--thread-content-max-width:48rem] [--thread-content-margin:clamp(1rem,4vw,4rem)] [--oddix-bg:#0b0f14] [--oddix-sidebar:#081019] [--oddix-surface:#101922] [--oddix-surface-2:#132231] [--oddix-border:rgba(16,185,129,.18)] [--oddix-green:#10b981]">
      <style jsx global>{`
        html,
        body {
          width: 100%;
          max-width: 100%;
          height: 100%;
          overflow: hidden;
          background: #0b0f14;
          overscroll-behavior: none;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }

        * {
          box-sizing: border-box;
        }

        .oddix-chat-root,
        .oddix-chat-root * {
          min-width: 0;
          writing-mode: horizontal-tb;
          text-orientation: mixed;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .oddix-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
        }

        .oddix-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .oddix-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .oddix-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.22);
          border-radius: 999px;
        }

        .oddix-message strong {
          color: #d1fae5;
          font-weight: 800;
        }

        .oddix-premium-bg {
          background:
            radial-gradient(circle at 50% 0%, rgba(16,185,129,.14), transparent 34%),
            radial-gradient(circle at 85% 18%, rgba(59,130,246,.10), transparent 30%),
            linear-gradient(180deg, #0b0f14 0%, #0b0f14 52%, #070b10 100%);
        }

        .oddix-glass {
          background: linear-gradient(180deg, rgba(16,25,34,.92), rgba(10,18,26,.92));
          border: 1px solid rgba(16,185,129,.16);
          box-shadow: 0 18px 60px rgba(0,0,0,.28);
        }

        .oddix-premium-chip {
          border: 1px solid rgba(16,185,129,.18);
          background: rgba(16,185,129,.08);
          color: #a7f3d0;
        }

        .oddix-logo-glow {
          box-shadow: 0 0 34px rgba(16,185,129,.32), inset 0 0 18px rgba(255,255,255,.08);
        }

        .oddix-chat-root textarea {
          scrollbar-width: thin;
        }

        .oddix-sidebar-label {
          opacity: 1;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }

        .oddix-sidebar-rail .oddix-sidebar-label {
          opacity: 0;
          transform: translateX(-4px);
          pointer-events: none;
        }

        @supports (height: 100svh) {
          .oddix-chat-root {
            height: 100svh;
          }
        }

        @media (max-width: 1023px) {
          .oddix-main-panel {
            position: fixed;
            inset: 0;
            z-index: 0;
            width: 100vw;
            height: 100dvh;
            min-height: 100dvh;
          }
        }

        @media (max-width: 1023px) and (not (height: 100dvh)) {
          .oddix-main-panel {
            height: 100vh;
            min-height: 100vh;
          }
        }
      `}</style>

      <div className="flex h-full w-full overflow-hidden">
        {mobileSidebarOpen && (
          <button
            type="button"
            aria-label="Fechar barra lateral"
            onClick={closeMobileSidebar}
            className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          />
        )}

        <aside
          className={[
            'fixed inset-y-0 left-0 z-50 flex h-full w-[var(--sidebar-width)] shrink-0 flex-col overflow-hidden border-r border-[#2a2a2a] bg-[var(--oddix-sidebar)] text-[#ecfff7] transition-[width,transform] duration-150 ease-out lg:relative lg:z-10 lg:translate-x-0',
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            sidebarOpen ? 'lg:w-[var(--sidebar-width)]' : 'lg:w-[var(--sidebar-rail-width)] oddix-sidebar-rail',
          ].join(' ')}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-[var(--header-height)] shrink-0 items-center justify-between px-3">
              <button
                type="button"
                onClick={handleNewConversation}
                className="flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
                aria-label="Início Oddix"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center oddix-logo-glow rounded-full bg-emerald-500/10 p-0.5">
                  <Image
                    src="/images/oddix-logo-icon.png"
                    alt="Oddix"
                    width={28}
                    height={28}
                    className="h-6 w-6 object-contain"
                    priority
                  />
                </span>
                {showSidebarLabels && <span className="oddix-sidebar-label truncate">Oddix</span>}
              </button>

              <button
                type="button"
                onClick={() => setSidebarOpen((current) => !current)}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 lg:flex"
                aria-label={sidebarOpen ? 'Fechar barra lateral' : 'Abrir barra lateral'}
              >
                {sidebarOpen ? '‹' : '›'}
              </button>

              <button
                type="button"
                onClick={closeMobileSidebar}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden"
                aria-label="Fechar histórico"
              >
                ✕
              </button>
            </div>

            <nav className="shrink-0 px-2 pb-2">
              <button
                type="button"
                onClick={handleNewConversation}
                className="group flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-white/88 hover:bg-white/10"
              >
                <span className="text-lg leading-none">＋</span>
                {showSidebarLabels && <span className="oddix-sidebar-label truncate">Novo chat</span>}
              </button>

              <button
                type="button"
                onClick={() => sendMessage('Busque os melhores jogos para analisar hoje.')}
                className="group mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-white/88 hover:bg-white/10"
              >
                <span className="text-lg leading-none">⌕</span>
                {showSidebarLabels && <span className="oddix-sidebar-label truncate">Buscar chats</span>}
              </button>

              <button
                type="button"
                onClick={() => sendMessage('Mostre minha biblioteca de análises Oddix: Top Picks, múltiplas e jogos ao vivo.')}
                className="group mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-white/88 hover:bg-white/10"
              >
                <span className="text-lg leading-none">▦</span>
                {showSidebarLabels && <span className="oddix-sidebar-label truncate">Biblioteca</span>}
              </button>
            </nav>

            <div className="oddix-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {showSidebarLabels && (
                <div className="mb-2 flex items-center justify-between px-3 text-xs font-medium text-white/45">
                  <span>Recentes</span>
                  {historyLoading && <span className="text-emerald-300/70">...</span>}
                </div>
              )}

              <div className="space-y-1">
                {chatSessions.length > 0
                  ? chatSessions.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.025 }}
                        className={[
                          'group flex w-full items-center rounded-xl text-left text-sm hover:bg-white/10',
                          sessionId === item.id ? 'bg-emerald-500/10 text-emerald-100' : 'text-white/82',
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          onClick={() => openSession(item.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                          title={getSessionTitle(item)}
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" />
                          {showSidebarLabels && (
                            <span className="oddix-sidebar-label min-w-0 flex-1">
                              <span className="block truncate">{getSessionTitle(item)}</span>
                              <span className="mt-0.5 block truncate text-xs text-white/38">{getSessionDesc(item)}</span>
                            </span>
                          )}
                        </button>

                        {showSidebarLabels && (
                          <button
                            type="button"
                            onClick={() => deleteSession(item.id)}
                            className="mr-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 hover:bg-red-500/10 hover:text-red-300 group-hover:flex"
                            aria-label="Excluir conversa"
                          >
                            ×
                          </button>
                        )}
                      </motion.div>
                    ))
                  : fallbackHistory.map((item, index) => (
                      <motion.button
                        key={item.id}
                        type="button"
                        onClick={() => sendMessage(item.prompt)}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.035 }}
                        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/82 hover:bg-white/10"
                        title={item.title}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" />
                        {showSidebarLabels && (
                          <span className="oddix-sidebar-label min-w-0 flex-1">
                            <span className="block truncate">{item.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-white/38">{item.desc}</span>
                          </span>
                        )}
                      </motion.button>
                    ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-white/5 p-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/12 text-xs font-black text-emerald-300">
                  PM
                </span>
                {showSidebarLabels && (
                  <span className="oddix-sidebar-label min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white/90">Pedro Magalhães</span>
                    <span className="block truncate text-xs text-white/42">Oddix Premium IA • {apiStatus}</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </aside>

        <section className="@container/main oddix-main-panel oddix-premium-bg relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--oddix-bg)]">
          <header className="sticky top-0 z-20 flex h-[var(--header-height)] shrink-0 items-center justify-between bg-[rgba(11,15,20,.86)] px-2 border-b border-[var(--oddix-border)] backdrop-blur-xl lg:px-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/82 hover:bg-white/10 lg:hidden"
                aria-label="Abrir barra lateral"
              >
                ☰
              </button>

              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="hidden h-10 w-10 items-center justify-center rounded-xl text-white/82 hover:bg-white/10 lg:flex"
                  aria-label="Abrir barra lateral"
                >
                  ☰
                </button>
              )}

              <button
                type="button"
                onClick={handleNewConversation}
                className="hidden h-10 w-10 items-center justify-center rounded-xl text-white/82 hover:bg-white/10 lg:flex"
                aria-label="Novo chat"
              >
                ✎
              </button>

              <div className="ml-1 flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-[15px] font-semibold text-white/92 hover:bg-white/5">
                <Image
                  src="/images/oddix-logo.png"
                  alt="Oddix"
                  width={118}
                  height={30}
                  className="h-6 w-auto object-contain"
                  priority
                />
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  V17
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={[
                  'hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex',
                  apiConnected ? 'bg-emerald-500/12 text-emerald-300' : 'bg-yellow-500/12 text-yellow-300',
                ].join(' ')}
              >
                {apiConnected ? '● API online' : '● API offline'}
              </span>

              <button
                type="button"
                onClick={() => sendMessage('Ative uma análise temporária com foco em risco baixo para o próximo jogo.')}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/82 hover:bg-white/10"
                aria-label="Chat temporário"
              >
                ⏱
              </button>
            </div>
          </header>

          <div
            ref={chatScrollRef}
            data-scroll-root=""
            className="oddix-scroll relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scroll-pt-[var(--header-height)] [scrollbar-gutter:stable]"
          >
            {!hasConversation ? (
              <div className="flex h-full min-h-0 flex-1 flex-col">
                <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-1 flex-col items-center justify-center px-[var(--thread-content-margin)] pb-4 pt-8 text-center">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className="mb-7 flex flex-col items-center"
                  >
                    <div className="mb-5 flex items-center justify-center">
                      <Image
                        src="/images/oddix-logo-banner.png"
                        alt="Oddix"
                        width={280}
                        height={90}
                        className="h-auto w-[220px] object-contain drop-shadow-[0_0_42px_rgba(16,185,129,.28)] sm:w-[280px]"
                        priority
                      />
                    </div>
                    <h1 className="text-balance text-[28px] font-normal leading-tight text-white sm:text-[32px]">
                      O que deseja analisar hoje?
                    </h1>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/48 sm:text-base">
                      Jogos, odds, estatísticas, notícias, múltiplas e análises profissionais com IA.
                    </p>

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
                      <span className="oddix-premium-chip rounded-full px-3 py-1.5">Real Stats Only</span>
                      <span className="oddix-premium-chip rounded-full px-3 py-1.5">Histórico Real</span>
                      <span className="oddix-premium-chip rounded-full px-3 py-1.5">Oddix Agents</span>
                    </div>
                  </motion.div>

                  <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                    {quickCards.map((item, index) => (
                      <motion.button
                        key={item[1]}
                        type="button"
                        onClick={() => sendMessage(item[2])}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 + index * 0.04 }}
                        className="oddix-glass rounded-2xl p-4 text-left text-white/88 transition hover:bg-[var(--oddix-surface-2)]"
                      >
                        <span className="text-xl">{item[0]}</span>
                        <span className="ml-2 text-sm font-semibold">{item[1]}</span>
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/48">{item[2]}</p>
                      </motion.button>
                    ))}
                  </div>

                  <div className="mt-3 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                    {suggestions.slice(0, 4).map((item, index) => (
                      <motion.button
                        key={item.label}
                        type="button"
                        onClick={() => sendMessage(item.prompt)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.24 + index * 0.04 }}
                        className="rounded-2xl border border-[var(--oddix-border)] bg-[rgba(16,25,34,.78)] px-3 py-3 text-sm text-white/76 hover:bg-[var(--oddix-surface-2)]"
                      >
                        <span className="mr-1.5">{item.icon}</span>
                        {item.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full px-[var(--thread-content-margin)] py-6">
                <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-col gap-7">
                  {messages.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={['flex w-full', item.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}
                    >
                      {item.role === 'assistant' && (
                        <div className="mr-3 mt-1 hidden h-8 w-8 shrink-0 items-center justify-center oddix-logo-glow rounded-full bg-emerald-500/10 p-1 sm:flex">
                          <Image
                            src="/images/oddix-logo-icon.png"
                            alt="Oddix"
                            width={24}
                            height={24}
                            className="h-6 w-6 object-contain"
                          />
                        </div>
                      )}

                      <div
                        className={[
                          'oddix-message max-w-[min(100%,42rem)] text-[15px] leading-7 sm:text-base',
                          item.role === 'user'
                            ? 'rounded-[26px] bg-[var(--oddix-surface)] px-5 py-3.5 text-white/92'
                            : 'px-0 py-1 text-white/88',
                        ].join(' ')}
                      >
                        {item.role === 'assistant' ? (
                          <MarkdownMessage content={item.content} />
                        ) : (
                          <span className="whitespace-pre-line">{item.content}</span>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-3 text-sm text-white/58"
                    >
                      <div className="hidden h-8 w-8 shrink-0 items-center justify-center oddix-logo-glow rounded-full bg-emerald-500/10 p-1 sm:flex">
                        <Image
                          src="/images/oddix-logo-icon.png"
                          alt="Oddix"
                          width={24}
                          height={24}
                          className="h-6 w-6 object-contain"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded-2xl bg-[var(--oddix-surface)] px-4 py-3">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/55 [animation-delay:-.2s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/55 [animation-delay:-.1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/55" />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-10 shrink-0 bg-[var(--oddix-bg)] px-[var(--thread-content-margin)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-2 sm:pb-4">
            <div className="mx-auto w-full max-w-[var(--thread-content-max-width)]">
              <motion.form
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                onSubmit={handleSubmit}
                className="relative min-h-[52px] rounded-[28px] bg-[var(--oddix-surface)] px-2 py-[9px] shadow-[0_0_0_1px_rgba(16,185,129,.16),0_12px_44px_rgba(0,0,0,.42),0_0_40px_rgba(16,185,129,.08)] transition-all duration-200 focus-within:shadow-[0_0_0_1px_rgba(16,185,129,.36),0_14px_52px_rgba(0,0,0,.48),0_0_48px_rgba(16,185,129,.14)]"
              >
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleNewConversation}
                    className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-white/75 hover:bg-white/10 hover:text-white"
                    aria-label="Nova conversa"
                  >
                    +
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    rows={1}
                    placeholder="Pergunte alguma coisa"
                    className="max-h-[30svh] min-h-10 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[15px] leading-6 text-white outline-none placeholder:text-white/40 sm:text-base"
                  />

                  <button
                    type="button"
                    onClick={() => setMessage('Ajuste a análise para risco baixo e odd máxima 2.00.')}
                    className="mb-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white sm:flex"
                    aria-label="Ajustar risco"
                  >
                    🎚️
                  </button>

                  <button
                    type="submit"
                    disabled={!message.trim() || isThinking}
                    className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-black transition hover:scale-105 disabled:cursor-not-allowed disabled:bg-white/18 disabled:text-white/40 disabled:hover:scale-100"
                    aria-label="Enviar mensagem"
                  >
                    {isThinking ? '…' : '↑'}
                  </button>
                </div>
              </motion.form>

              <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] leading-relaxed text-white/42">
                Oddix IA usa dados, mercado e contexto. Confirme informações antes de apostar.{' '}
                <span className="font-semibold text-emerald-300">+18 • Jogue com responsabilidade.</span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
