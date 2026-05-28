'use client';

import { useState } from 'react';
import { api } from '../services/api';

export default function Home() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('lucas@email.com');
  const [password, setPassword] = useState('123456');

  async function handleLogin() {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      localStorage.setItem(
        'token',
        response.data.access_token || response.data.token,
      );

      window.location.href = '/dashboard';
    } catch {
      alert('Erro ao fazer login.');
    }
  }

  async function handleRegister() {
    try {
      if (!name || !email || !password) {
        alert('Preencha nome, email e senha.');
        return;
      }

      const response = await api.post('/auth/register', {
        name,
        email,
        password,
      });

      localStorage.setItem(
        'token',
        response.data.access_token || response.data.token,
      );

      localStorage.setItem('oddix_plan', 'Free');

      window.location.href = '/dashboard';
    } catch {
      alert('Erro ao criar conta. Talvez esse email já exista.');
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.overlay} />

      <section style={styles.loginBox}>
        <img src="/oddix-logo.png" style={styles.logo} />

        <p style={styles.subtitle}>
          Plataforma VIP de apostas com inteligência artificial.
        </p>

        <div style={styles.badges}>
          <span style={styles.badge}>🤖 IA</span>
          <span style={styles.badge}>📊 Odds</span>
          <span style={styles.badge}>🔥 VIP</span>
        </div>

        <div style={styles.tabs}>
          <button
            style={mode === 'login' ? styles.activeTab : styles.tab}
            onClick={() => setMode('login')}
          >
            Entrar
          </button>

          <button
            style={mode === 'register' ? styles.activeTab : styles.tab}
            onClick={() => setMode('register')}
          >
            Criar conta
          </button>
        </div>

        {mode === 'register' && (
          <input
            style={styles.input}
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}

        <input
          style={styles.input}
          placeholder="Seu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          style={styles.input}
          placeholder="Sua senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === 'login' ? (
          <button style={styles.enterButton} onClick={handleLogin}>
            Entrar
          </button>
        ) : (
          <button style={styles.enterButton} onClick={handleRegister}>
            Criar minha conta
          </button>
        )}

        <p style={styles.footer}>
          {mode === 'login'
            ? 'Acesse sua sala VIP de palpites inteligentes.'
            : 'Crie sua conta grátis e comece no plano Free.'}
        </p>
      </section>
    </main>
  );
}

const styles = {
  page: {
    width: '100vw',
    minHeight: '100vh',
    backgroundImage:
      'url("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2400&q=90")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
    position: 'relative' as const,
    overflow: 'hidden',
  },

  overlay: {
    position: 'absolute' as const,
    inset: 0,
    background: 'linear-gradient(rgba(0,0,0,.72), rgba(0,0,0,.96))',
  },

  loginBox: {
    position: 'relative' as const,
    zIndex: 2,
    width: '100%',
    maxWidth: '520px',
    background: 'rgba(0,0,0,.62)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '34px',
    padding: '34px 42px',
    boxShadow: '0 0 70px rgba(0,0,0,.85)',
    backdropFilter: 'blur(14px)',
  },

  logo: {
    width: '420px',
    height: '190px',
    maxWidth: '100%',
    objectFit: 'contain' as const,
    display: 'block',
    margin: '0 auto 8px',
    filter: 'drop-shadow(0 0 26px rgba(0,0,0,.95))',
  },

  subtitle: {
    textAlign: 'center' as const,
    color: '#e5e7eb',
    fontSize: '16px',
    margin: '0 0 20px',
  },

  badges: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '22px',
  },

  badge: {
    background: 'rgba(0,0,0,.55)',
    border: '1px solid rgba(255,255,255,.14)',
    padding: '8px 20px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '14px',
  },

  tabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '18px',
  },

  tab: {
    background: 'rgba(0,0,0,.42)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.18)',
    padding: '13px',
    borderRadius: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  activeTab: {
    background: 'linear-gradient(135deg,#16a34a,#a3e635)',
    color: '#020402',
    border: 0,
    padding: '13px',
    borderRadius: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  input: {
    width: '100%',
    background: 'rgba(0,0,0,.68)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.16)',
    borderRadius: '15px',
    padding: '16px',
    marginBottom: '13px',
    outline: 'none',
  },

  enterButton: {
    width: '100%',
    background: 'linear-gradient(135deg,#16a34a,#a3e635)',
    color: '#020402',
    border: 0,
    padding: '16px',
    borderRadius: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '8px',
  },

  footer: {
    textAlign: 'center' as const,
    color: '#a1a1aa',
    fontSize: '13px',
    marginTop: '20px',
    lineHeight: 1.5,
  },
};