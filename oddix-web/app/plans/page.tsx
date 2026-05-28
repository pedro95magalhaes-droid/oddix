'use client';

import { api } from '../../services/api';

export default function Plans() {
  async function activatePlan(plan: string) {
    try {
      await api.patch('/auth/plan', { plan });

      alert(`Plano ${plan} ativado com sucesso!`);
      window.location.href = '/dashboard';
    } catch {
      alert('Erro ao ativar plano. Faça login novamente.');
      window.location.href = '/';
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.overlay} />

      <header style={styles.header}>
        <img src="/oddix-logo.png" style={styles.logo} />

        <button
          style={styles.backButton}
          onClick={() => {
            window.location.href = '/dashboard';
          }}
        >
          ← Voltar ao dashboard
        </button>
      </header>

      <section style={styles.hero}>
        <span style={styles.badge}>ODDIX VIP</span>

        <h1 style={styles.title}>Escolha seu acesso premium</h1>

        <p style={styles.subtitle}>
          Desbloqueie análises completas da IA, filtros avançados, entradas VIP
          e leitura profissional dos palpites.
        </p>
      </section>

      <section style={styles.grid}>
        <PlanCard
          name="Free"
          price="R$0"
          period="/ grátis"
          description="Ideal para conhecer a Oddix."
          features={[
            'Dashboard básico',
            'Palpites limitados',
            'Status dos palpites',
            'Sem análise completa',
          ]}
          button="Usar plano Free"
          onClick={() => activatePlan('Free')}
        />

        <PlanCard
          name="Pro"
          price="R$19,99"
          period="/ mês"
          description="Para quem quer análises completas."
          features={[
            'Tudo do Free',
            'Análise completa da IA',
            'Leitura de risco',
            'Confiança da IA',
            'Filtros avançados',
          ]}
          button="Ativar Pro"
          highlight
          onClick={() => activatePlan('Pro')}
        />

        <PlanCard
          name="Vip"
          price="R$57"
          period="/ mês"
          description="Acesso máximo para sala premium."
          features={[
            'Tudo do Pro',
            'Entradas VIP',
            'Prioridade nos palpites',
            'Gestão de banca',
            'Melhores oportunidades',
            'Acesso completo',
          ]}
          button="Entrar no Vip"
          vip
          onClick={() => activatePlan('Vip')}
        />
      </section>

      <section style={styles.compareBox}>
        <h2>O que você libera no VIP?</h2>

        <div style={styles.compareGrid}>
          <div style={styles.compareItem}>🤖 Análise IA detalhada</div>
          <div style={styles.compareItem}>📈 Valor esperado</div>
          <div style={styles.compareItem}>🔥 Entradas premium</div>
          <div style={styles.compareItem}>🛡 Gestão de risco</div>
          <div style={styles.compareItem}>⚡ Leitura rápida do mercado</div>
          <div style={styles.compareItem}>🏆 Palpites com status</div>
        </div>
      </section>
    </main>
  );
}

function PlanCard({
  name,
  price,
  period,
  description,
  features,
  button,
  highlight,
  vip,
  onClick,
}: any) {
  return (
    <div
      style={{
        ...styles.card,
        ...(highlight ? styles.highlightCard : {}),
        ...(vip ? styles.vipCard : {}),
      }}
    >
      {highlight && <span style={styles.popular}>MAIS POPULAR</span>}
      {vip && <span style={styles.vipBadge}>MÁXIMO ACESSO</span>}

      <h2 style={styles.planName}>{name}</h2>

      <div style={styles.priceBox}>
        <strong>{price}</strong>
        <span>{period}</span>
      </div>

      <p style={styles.description}>{description}</p>

      <ul style={styles.list}>
        {features.map((feature: string) => (
          <li key={feature}>✔ {feature}</li>
        ))}
      </ul>

      <button
        style={vip || highlight ? styles.greenButton : styles.darkButton}
        onClick={onClick}
      >
        {button}
      </button>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    color: '#fff',
    padding: '28px',
    fontFamily: 'Arial, sans-serif',
    backgroundImage:
      'linear-gradient(rgba(0,0,0,.78), rgba(0,0,0,.96)), url("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2200&q=90")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'relative' as const,
    overflowX: 'hidden' as const,
  },

  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,.18)',
    pointerEvents: 'none' as const,
  },

  header: {
    position: 'relative' as const,
    zIndex: 2,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },

  logo: {
    width: '300px',
    height: '130px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 24px rgba(0,0,0,.95))',
  },

  backButton: {
    background: 'rgba(0,0,0,.45)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.2)',
    padding: '13px 18px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  hero: {
    position: 'relative' as const,
    zIndex: 2,
    maxWidth: '900px',
    margin: '0 auto 34px',
    textAlign: 'center' as const,
  },

  badge: {
    display: 'inline-block',
    background: '#22c55e',
    color: '#000',
    padding: '8px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
    marginBottom: '12px',
  },

  title: {
    fontSize: '54px',
    margin: '10px 0',
  },

  subtitle: {
    color: '#d4d4d8',
    fontSize: '18px',
    lineHeight: 1.6,
  },

  grid: {
    position: 'relative' as const,
    zIndex: 2,
    maxWidth: '1180px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
    gap: '22px',
  },

  card: {
    background: 'rgba(7,7,10,.78)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '30px',
    padding: '30px',
    boxShadow: '0 25px 65px rgba(0,0,0,.45)',
    backdropFilter: 'blur(14px)',
    position: 'relative' as const,
  },

  highlightCard: {
    border: '1px solid rgba(34,197,94,.55)',
    boxShadow: '0 0 70px rgba(34,197,94,.18)',
    transform: 'scale(1.03)',
  },

  vipCard: {
    border: '1px solid rgba(250,204,21,.5)',
    boxShadow: '0 0 70px rgba(250,204,21,.14)',
  },

  popular: {
    position: 'absolute' as const,
    top: '-14px',
    left: '24px',
    background: '#22c55e',
    color: '#000',
    padding: '7px 12px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '11px',
  },

  vipBadge: {
    position: 'absolute' as const,
    top: '-14px',
    left: '24px',
    background: '#facc15',
    color: '#000',
    padding: '7px 12px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '11px',
  },

  planName: {
    fontSize: '30px',
    marginBottom: '12px',
  },

  priceBox: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    marginBottom: '14px',
  },

  description: {
    color: '#d4d4d8',
    lineHeight: 1.5,
  },

  list: {
    listStyle: 'none',
    padding: 0,
    margin: '22px 0',
    minHeight: '190px',
    lineHeight: 2,
    color: '#e5e7eb',
  },

  greenButton: {
    width: '100%',
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#000',
    border: 0,
    padding: '15px',
    borderRadius: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  darkButton: {
    width: '100%',
    background: 'rgba(0,0,0,.45)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.2)',
    padding: '15px',
    borderRadius: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  compareBox: {
    position: 'relative' as const,
    zIndex: 2,
    maxWidth: '1180px',
    margin: '34px auto 0',
    background: 'rgba(0,0,0,.62)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '28px',
    padding: '28px',
    textAlign: 'center' as const,
  },

  compareGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    marginTop: '20px',
  },

  compareItem: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: '16px',
    padding: '16px',
    fontWeight: 'bold',
  },
};