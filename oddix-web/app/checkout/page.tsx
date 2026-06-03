'use client';

import { useMemo, useState } from 'react';

const WHATSAPP_NUMBER = '5585997197447';
const VIP_PRICE = 'R$ 29,90';
const VIP_PERIOD = 'mensal';
const PIX_KEY = '85997197447';

function buildWhatsAppMessage(plan: string) {
  const text = [
    'Olá, quero assinar o ODDIX VIP.',
    '',
    `Plano: ${plan}`,
    `Valor: ${VIP_PRICE}/${VIP_PERIOD}`,
    '',
    'Pode me enviar as instruções de pagamento?',
  ].join('\n');

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function copyToClipboard(value: string) {
  if (typeof navigator === 'undefined') return;
  navigator.clipboard?.writeText(value).catch(() => null);
}

export default function CheckoutPage() {
  const [copied, setCopied] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('ODDIX VIP Mensal');

  const whatsappUrl = useMemo(() => buildWhatsAppMessage(selectedPlan), [selectedPlan]);

  function handleCopyPix() {
    copyToClipboard(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main style={styles.page}>
      <div style={styles.bgGlowOne} />
      <div style={styles.bgGlowTwo} />

      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => (window.location.href = '/plans')}>
          ← Voltar
        </button>

        <div style={styles.brandBox} onClick={() => (window.location.href = '/dashboard')}>
          <img src="/logo-oddix-horizontal.png" alt="ODDIX" style={styles.logo} />
        </div>

        <button style={styles.loginButton} onClick={() => (window.location.href = '/dashboard')}>
          Entrar
        </button>
      </header>

      <section style={styles.hero}>
        <div style={styles.left}>
          <span style={styles.kicker}>ODDIX VIP CHECKOUT</span>

          <h1 style={styles.title}>
            Entre para o VIP e receba entradas com IA, cards premium e acompanhamento ao vivo.
          </h1>

          <p style={styles.subtitle}>
            O Oddix foi criado para entregar uma experiência premium: análise inteligente, gestão de banca,
            alertas de GREEN/RED, Player Props e acompanhamento por voz no WhatsApp.
          </p>

          <div style={styles.benefitsGrid}>
            <Benefit icon="🤖" title="IA Premium" text="Entradas filtradas por qualidade, odd e risco." />
            <Benefit icon="🎯" title="Player Props" text="Mercados de jogador quando houver linha disponível." />
            <Benefit icon="🎤" title="Alertas por voz" text="GREEN, RED e ALMOST GREEN com áudio humano." />
            <Benefit icon="💎" title="Cards VIP" text="Cards premium prontos para acompanhamento." />
          </div>

          <div style={styles.noticeBox}>
            <strong>Jogue com responsabilidade.</strong>
            <span>O Oddix não garante lucro. Use gestão de banca e nunca aposte dinheiro que não pode perder.</span>
          </div>
        </div>

        <aside style={styles.checkoutCard}>
          <div style={styles.checkoutTop}>
            <span style={styles.vipBadge}>💎 VIP</span>
            <h2 style={styles.cardTitle}>Finalize sua assinatura</h2>
            <p style={styles.cardText}>Escolha o plano e fale com o atendimento para liberação do acesso.</p>
          </div>

          <div style={styles.planBox}>
            <label style={styles.planOption}>
              <input
                type="radio"
                name="plan"
                checked={selectedPlan === 'ODDIX VIP Mensal'}
                onChange={() => setSelectedPlan('ODDIX VIP Mensal')}
              />
              <div>
                <strong>ODDIX VIP Mensal</strong>
                <span>Acesso aos sinais VIP, cards, voz e acompanhamento.</span>
              </div>
              <strong style={styles.price}>{VIP_PRICE}</strong>
            </label>
          </div>

          <div style={styles.summaryBox}>
            <SummaryLine label="Plano" value={selectedPlan} />
            <SummaryLine label="Período" value={VIP_PERIOD} />
            <SummaryLine label="Total" value={VIP_PRICE} strong />
          </div>

          <div style={styles.pixBox}>
            <span style={styles.smallLabel}>Chave Pix</span>
            <div style={styles.pixRow}>
              <strong>{PIX_KEY}</strong>
              <button style={styles.copyButton} onClick={handleCopyPix}>
                {copied ? 'Copiado ✅' : 'Copiar'}
              </button>
            </div>
            <small style={styles.pixHint}>
              Após o pagamento, envie o comprovante no WhatsApp para liberar seu VIP.
            </small>
          </div>

          <a href={whatsappUrl} target="_blank" rel="noreferrer" style={styles.whatsappButton}>
            Finalizar pelo WhatsApp
          </a>

          <button style={styles.secondaryButton} onClick={() => (window.location.href = '/plans')}>
            Ver outros planos
          </button>

          <div style={styles.secureBox}>
            <span>🔒 Liberação manual segura</span>
            <span>⚡ Atendimento rápido</span>
            <span>📲 Acesso via WhatsApp</span>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Benefit({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div style={styles.benefitCard}>
      <span style={styles.benefitIcon}>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={styles.summaryLine}>
      <span>{label}</span>
      <strong style={strong ? styles.summaryStrong : undefined}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#050505',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
    padding: '28px',
  },
  bgGlowOne: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: '999px',
    background: 'rgba(34,197,94,.18)',
    filter: 'blur(70px)',
    top: -120,
    left: -90,
  },
  bgGlowTwo: {
    position: 'absolute',
    width: 460,
    height: 460,
    borderRadius: '999px',
    background: 'rgba(245,158,11,.16)',
    filter: 'blur(80px)',
    right: -140,
    bottom: -150,
  },
  header: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 34,
  },
  brandBox: {
    cursor: 'pointer',
  },
  logo: {
    width: 230,
    height: 72,
    objectFit: 'contain',
  },
  backButton: {
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.14)',
    borderRadius: 14,
    padding: '12px 16px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  loginButton: {
    background: '#22c55e',
    color: '#000',
    border: 0,
    borderRadius: 14,
    padding: '12px 18px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  hero: {
    position: 'relative',
    zIndex: 2,
    maxWidth: 1220,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1.1fr .9fr',
    gap: 28,
    alignItems: 'center',
  },
  left: {
    background: 'linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.03))',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 30,
    padding: 34,
    boxShadow: '0 24px 80px rgba(0,0,0,.35)',
  },
  kicker: {
    display: 'inline-flex',
    color: '#22c55e',
    fontWeight: 900,
    letterSpacing: 1.3,
    fontSize: 13,
    marginBottom: 14,
  },
  title: {
    fontSize: 46,
    lineHeight: 1.02,
    margin: '0 0 16px',
    maxWidth: 760,
  },
  subtitle: {
    color: '#d4d4d8',
    fontSize: 17,
    lineHeight: 1.6,
    margin: '0 0 24px',
    maxWidth: 760,
  },
  benefitsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 14,
  },
  benefitCard: {
    background: 'rgba(0,0,0,.36)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 18,
    padding: 16,
  },
  benefitIcon: {
    display: 'inline-flex',
    fontSize: 24,
    marginBottom: 8,
  },
  noticeBox: {
    marginTop: 18,
    background: 'rgba(245,158,11,.12)',
    border: '1px solid rgba(245,158,11,.24)',
    borderRadius: 18,
    padding: 15,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    color: '#fde68a',
  },
  checkoutCard: {
    background: 'linear-gradient(180deg, rgba(17,24,39,.96), rgba(0,0,0,.92))',
    border: '1px solid rgba(34,197,94,.28)',
    borderRadius: 30,
    padding: 28,
    boxShadow: '0 30px 100px rgba(34,197,94,.12)',
  },
  checkoutTop: {
    marginBottom: 18,
  },
  vipBadge: {
    display: 'inline-flex',
    background: 'rgba(34,197,94,.16)',
    border: '1px solid rgba(34,197,94,.32)',
    color: '#86efac',
    borderRadius: 999,
    padding: '8px 12px',
    fontWeight: 900,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 31,
    margin: '0 0 8px',
  },
  cardText: {
    color: '#cbd5e1',
    lineHeight: 1.5,
    margin: 0,
  },
  planBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16,
  },
  planOption: {
    display: 'grid',
    gridTemplateColumns: '24px 1fr auto',
    gap: 12,
    alignItems: 'center',
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 18,
    padding: 16,
    cursor: 'pointer',
  },
  price: {
    color: '#22c55e',
    fontSize: 20,
  },
  summaryBox: {
    background: 'rgba(0,0,0,.36)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  summaryLine: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 0',
    color: '#d4d4d8',
  },
  summaryStrong: {
    color: '#22c55e',
    fontSize: 22,
  },
  pixBox: {
    background: 'rgba(34,197,94,.08)',
    border: '1px solid rgba(34,197,94,.2)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  smallLabel: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pixRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  copyButton: {
    background: '#22c55e',
    color: '#000',
    border: 0,
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  pixHint: {
    display: 'block',
    color: '#bbf7d0',
    marginTop: 10,
    lineHeight: 1.45,
  },
  whatsappButton: {
    display: 'flex',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #22c55e, #a3e635)',
    color: '#000',
    textDecoration: 'none',
    borderRadius: 16,
    padding: '16px 18px',
    fontWeight: 1000,
    marginBottom: 12,
    boxShadow: '0 14px 38px rgba(34,197,94,.22)',
  },
  secondaryButton: {
    width: '100%',
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.14)',
    borderRadius: 16,
    padding: '15px 18px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  secureBox: {
    marginTop: 16,
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 8,
    color: '#cbd5e1',
    fontSize: 13,
  },
};
