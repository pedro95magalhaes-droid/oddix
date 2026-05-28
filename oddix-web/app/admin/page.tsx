'use client';

import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function Admin() {
  const today = new Date().toISOString().slice(0, 10);

  const [users, setUsers] = useState<any[]>([]);
  const [bets, setBets] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [gameDate, setGameDate] = useState(today);
  const [editingBetId, setEditingBetId] = useState<string | null>(null);

  const [form, setForm] = useState<any>({
    homeTeam: '',
    awayTeam: '',
    league: '',
    tip: '',
    odd: '',
    confidence: '',
    status: 'open',
    homeLogo: '',
    awayLogo: '',
    leagueLogo: '',
    fixtureId: '',
    gameDate: '',
    markets: [],
    analysis: '',
    risk: '',
  });

  async function loadUsers() {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch {
      alert('Acesso negado. Apenas administradores.');
      window.location.href = '/dashboard';
    }
  }

  async function loadBets() {
    try {
      const response = await api.get('/admin/bets');
      setBets(response.data);
    } catch {
      alert('Erro ao carregar palpites.');
    }
  }

  async function loadStats() {
    try {
      const response = await api.get('/stats');
      setStats(response.data);
    } catch {
      setStats(null);
    }
  }

  async function loadAiLogs() {
    try {
      const response = await api.get('/admin/ai-logs');
      setAiLogs(Array.isArray(response.data) ? response.data : []);
    } catch {
      setAiLogs([]);
    }
  }

  async function loadGames() {
    try {
      const response = await api.get(`/football/fixtures?date=${gameDate}`);
      setGames(response.data);
    } catch {
      alert('Erro ao buscar jogos reais.');
    }
  }

  function useGame(game: any) {
    setForm({
      ...form,
      homeTeam: game.teams?.home?.name || '',
      awayTeam: game.teams?.away?.name || '',
      league: game.league?.name || '',
      homeLogo: game.teams?.home?.logo || '',
      awayLogo: game.teams?.away?.logo || '',
      leagueLogo: game.league?.logo || '',
      fixtureId: String(game.fixture?.id || ''),
      gameDate: game.fixture?.date || '',
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function generateAiBet(game: any) {
    try {
      const response = await api.post('/ai/generate-bet', {
        homeTeam: game.teams?.home?.name,
        awayTeam: game.teams?.away?.name,
        league: game.league?.name,
        teams: game.teams,
      });

      const ai = response.data;

      setForm({
        ...form,
        homeTeam: game.teams?.home?.name || '',
        awayTeam: game.teams?.away?.name || '',
        league: game.league?.name || '',
        tip: ai.tip || '',
        odd: String(ai.odd || ''),
        confidence: String(ai.confidence || ''),
        status: 'open',
        homeLogo: game.teams?.home?.logo || '',
        awayLogo: game.teams?.away?.logo || '',
        leagueLogo: game.league?.logo || '',
        fixtureId: String(game.fixture?.id || ''),
        gameDate: game.fixture?.date || '',
        markets: ai.markets || [],
        analysis: ai.analysis || '',
        risk: ai.risk || '',
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
      alert('IA gerou 5 mercados para este jogo.');
    } catch {
      alert('Erro ao gerar palpite com IA.');
    }
  }

  async function syncResults() {
    try {
      const response = await api.post('/admin/bets/sync-results');

      alert(
        `Resultados atualizados automaticamente!

Verificados: ${response.data.checked}
Ganhos: ${response.data.updatedWon}
Perdidos: ${response.data.updatedLost}
Ainda abertos: ${response.data.stillOpen}`,
      );

      loadBets();
      loadStats();
      loadAiLogs();
    } catch {
      alert('Erro ao atualizar resultados automaticamente.');
    }
  }

  function resetForm() {
    setEditingBetId(null);
    setForm({
      homeTeam: '',
      awayTeam: '',
      league: '',
      tip: '',
      odd: '',
      confidence: '',
      status: 'open',
      homeLogo: '',
      awayLogo: '',
      leagueLogo: '',
      fixtureId: '',
      gameDate: '',
      markets: [],
      analysis: '',
      risk: '',
    });
  }

  function startEditBet(bet: any) {
    setEditingBetId(bet.id);

    setForm({
      homeTeam: bet.homeTeam || '',
      awayTeam: bet.awayTeam || '',
      league: bet.league || '',
      tip: bet.tip || '',
      odd: String(bet.odd || ''),
      confidence: String(bet.confidence || ''),
      status: bet.status || 'open',
      homeLogo: bet.homeLogo || '',
      awayLogo: bet.awayLogo || '',
      leagueLogo: bet.leagueLogo || '',
      fixtureId: String(bet.fixtureId || ''),
      gameDate: bet.gameDate || '',
      markets: Array.isArray(bet.markets) ? bet.markets : [],
      analysis: bet.analysis || '',
      risk: bet.risk || '',
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveBet() {
    if (!form.homeTeam || !form.awayTeam || !form.league || !form.tip || !form.odd || !form.confidence) {
      alert('Preencha todos os campos do palpite.');
      return;
    }

    const payload = {
      homeTeam: form.homeTeam,
      awayTeam: form.awayTeam,
      league: form.league,
      tip: form.tip,
      odd: Number(form.odd),
      confidence: Number(form.confidence),
      status: form.status,
      homeLogo: form.homeLogo,
      awayLogo: form.awayLogo,
      leagueLogo: form.leagueLogo,
      fixtureId: form.fixtureId,
      gameDate: form.gameDate,
      markets: form.markets,
      analysis: form.analysis,
      risk: form.risk,
    };

    try {
      if (editingBetId) {
        await api.patch(`/admin/bets/${editingBetId}`, payload);
        alert('Palpite atualizado com sucesso.');
      } else {
        await api.post('/admin/bets', payload);
        alert('Palpite criado com sucesso.');
      }

      resetForm();
      loadBets();
      loadStats();
      loadAiLogs();
    } catch {
      alert('Erro ao salvar palpite.');
    }
  }

  async function deleteBet(id: string) {
    if (!confirm('Tem certeza que deseja excluir este palpite?')) return;

    try {
      await api.delete(`/admin/bets/${id}`);
      alert('Palpite excluído.');
      loadBets();
      loadStats();
      loadAiLogs();
    } catch {
      alert('Erro ao excluir palpite.');
    }
  }

  async function changePlan(userId: string, plan: string) {
    try {
      await api.patch(`/admin/users/${userId}/plan`, { plan });
      loadUsers();
    } catch {
      alert('Erro ao alterar plano.');
    }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      loadUsers();
    } catch {
      alert('Erro ao alterar role.');
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm('Excluir este usuário?')) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      loadUsers();
    } catch {
      alert('Erro ao excluir usuário.');
    }
  }

  const latestLog = aiLogs[0];

  useEffect(() => {
    loadUsers();
    loadBets();
    loadStats();
    loadAiLogs();
    loadGames();
  }, []);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <img src="/oddix-logo.png" style={styles.logo} />

        <button style={styles.backButton} onClick={() => (window.location.href = '/dashboard')}>
          Voltar ao dashboard
        </button>
      </header>

      <section style={styles.panel}>
        <h1 style={styles.title}>Painel Admin</h1>
        <p style={styles.subtitle}>
          Controle de usuários, palpites, jogos reais, mercados gerados pela IA e estatísticas.
        </p>

        <div style={styles.statsGrid}>
          <Stat label="Usuários" value={users.length} />
          <Stat label="Palpites" value={stats?.totalBets ?? bets.length} />
          <Stat label="Jogos reais" value={games.length} />
          <Stat label="Admins" value={users.filter((u) => u.role === 'ADMIN').length} />
          <Stat label="Em aberto" value={stats?.openBets ?? 0} />
          <Stat label="Ganhos" value={stats?.wonBets ?? 0} />
          <Stat label="Perdidos" value={stats?.lostBets ?? 0} />
          <Stat label="Taxa de acerto" value={`${stats?.winRate ?? 0}%`} />
          <Stat label="Odd média" value={stats?.averageOdd ?? '-'} />
          <Stat label="ROI" value={`${stats?.roi ?? 0}%`} />
          <Stat label="Lucro simulado" value={`R$ ${stats?.profit ?? 0}`} />
          <Stat label="Banca por entrada" value={`R$ ${stats?.simulatedStake ?? 10}`} />
        </div>

        <div style={styles.bestBox}>
          <div style={styles.bestCard}>
            <span>🏆 Melhor liga</span>
            <strong>{stats?.bestLeague || '-'}</strong>
          </div>

          <div style={styles.bestCard}>
            <span>🎯 Melhor mercado</span>
            <strong>{stats?.bestMarket || '-'}</strong>
          </div>

          <button style={styles.refreshStatsButton} onClick={syncResults}>
            Atualizar resultados automaticamente
          </button>
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Log da IA</h2>
        <p style={styles.subtitle}>
          Acompanhamento das verificações automáticas e manuais dos resultados.
        </p>

        {latestLog ? (
          <div style={styles.aiLogHighlight}>
            <div>
              <span>Última verificação</span>
              <strong>{new Date(latestLog.createdAt).toLocaleString('pt-BR')}</strong>
            </div>

            <div>
              <span>Origem</span>
              <strong>{latestLog.source === 'auto' ? 'Automática' : 'Manual'}</strong>
            </div>

            <div>
              <span>Verificados</span>
              <strong>{latestLog.checked}</strong>
            </div>

            <div>
              <span>Ganhos</span>
              <strong>{latestLog.updatedWon}</strong>
            </div>

            <div>
              <span>Perdidos</span>
              <strong>{latestLog.updatedLost}</strong>
            </div>

            <div>
              <span>Ainda abertos</span>
              <strong>{latestLog.stillOpen}</strong>
            </div>
          </div>
        ) : (
          <div style={styles.emptyBox}>
            Nenhum log da IA ainda. Aguarde a verificação automática ou clique em atualizar resultados.
          </div>
        )}

        <div style={styles.aiLogList}>
          {aiLogs.slice(0, 10).map((log) => (
            <div key={log.id} style={styles.aiLogRow}>
              <div>
                <strong>{new Date(log.createdAt).toLocaleString('pt-BR')}</strong>
                <p style={styles.smallText}>
                  Origem: {log.source === 'auto' ? 'Automática' : 'Manual'}
                </p>
              </div>

              <span style={styles.badge}>Verificados {log.checked}</span>
              <span style={styles.winBadge}>Ganhos {log.updatedWon}</span>
              <span style={styles.lostBadge}>Perdidos {log.updatedLost}</span>
              <span style={styles.role}>Abertos {log.stillOpen}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>{editingBetId ? 'Editar palpite' : 'Criar palpite'}</h2>

        {(form.homeLogo || form.awayLogo || form.leagueLogo) && (
          <div style={styles.previewBox}>
            {form.leagueLogo && <img src={form.leagueLogo} style={styles.previewLeagueLogo} />}
            {form.homeLogo && <img src={form.homeLogo} style={styles.previewLogo} />}
            <strong>{form.homeTeam} x {form.awayTeam}</strong>
            {form.awayLogo && <img src={form.awayLogo} style={styles.previewLogo} />}
          </div>
        )}

        <div style={styles.formGrid}>
          <input style={styles.input} placeholder="Time casa" value={form.homeTeam} onChange={(e) => setForm({ ...form, homeTeam: e.target.value })} />
          <input style={styles.input} placeholder="Time visitante" value={form.awayTeam} onChange={(e) => setForm({ ...form, awayTeam: e.target.value })} />
          <input style={styles.input} placeholder="Liga" value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })} />
          <input style={styles.input} placeholder="Entrada principal" value={form.tip} onChange={(e) => setForm({ ...form, tip: e.target.value })} />
          <input style={styles.input} placeholder="Odd" type="number" value={form.odd} onChange={(e) => setForm({ ...form, odd: e.target.value })} />
          <input style={styles.input} placeholder="Confiança IA" type="number" value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })} />

          <select style={styles.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="open">Aberto</option>
            <option value="won">Ganhou</option>
            <option value="lost">Perdeu</option>
          </select>

          <input style={styles.input} placeholder="Risco" value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value })} />
          <input style={styles.input} placeholder="Logo casa" value={form.homeLogo} onChange={(e) => setForm({ ...form, homeLogo: e.target.value })} />
          <input style={styles.input} placeholder="Logo visitante" value={form.awayLogo} onChange={(e) => setForm({ ...form, awayLogo: e.target.value })} />
          <input style={styles.input} placeholder="Logo liga" value={form.leagueLogo} onChange={(e) => setForm({ ...form, leagueLogo: e.target.value })} />
        </div>

        <textarea
          style={styles.textarea}
          placeholder="Análise da IA"
          value={form.analysis}
          onChange={(e) => setForm({ ...form, analysis: e.target.value })}
        />

        {form.markets?.length > 0 && (
          <div style={styles.marketsPreview}>
            <h3>5 mercados gerados pela IA</h3>

            <div style={styles.marketsGrid}>
              {form.markets.map((market: any, index: number) => (
                <div key={index} style={styles.marketCard}>
                  <span style={styles.marketCategory}>{market.category}</span>
                  <strong>{market.market}</strong>
                  <p>{market.tip}</p>

                  <div style={styles.marketInfo}>
                    <span>Odd {market.odd}</span>
                    <span>{market.confidence}%</span>
                    <span>{market.risk}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={styles.formActions}>
          <button style={styles.createButton} onClick={saveBet}>
            {editingBetId ? 'Salvar alterações' : 'Criar palpite'}
          </button>

          {editingBetId && (
            <button style={styles.cancelButton} onClick={resetForm}>
              Cancelar edição
            </button>
          )}
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Jogos reais</h2>

        <div style={styles.realGamesTop}>
          <input style={styles.input} type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
          <button style={styles.blueButton} onClick={loadGames}>Buscar jogos</button>
        </div>

        <div style={styles.gamesList}>
          {games.map((game) => (
            <div key={game.fixture?.id} style={styles.gameRow}>
              <div style={styles.realGameTeams}>
                <img src={game.teams?.home?.logo} style={styles.realLogo} />
                <div>
                  <strong>{game.teams?.home?.name} x {game.teams?.away?.name}</strong>
                  <p style={styles.smallText}>{game.league?.name} • {game.league?.country}</p>
                </div>
                <img src={game.teams?.away?.logo} style={styles.realLogo} />
              </div>

              <span style={styles.dateBadge}>
                {new Date(game.fixture?.date).toLocaleString('pt-BR')}
              </span>

              <button style={styles.greenSmallButton} onClick={() => useGame(game)}>
                Usar
              </button>

              <button style={styles.aiButton} onClick={() => generateAiBet(game)}>
                🤖 Gerar IA
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Palpites cadastrados</h2>

        <div style={styles.betList}>
          {bets.map((bet) => (
            <div key={bet.id} style={styles.betRow}>
              <div style={styles.betTeams}>
                {bet.homeLogo && <img src={bet.homeLogo} style={styles.realLogo} />}

                <div>
                  <strong>{bet.homeTeam} x {bet.awayTeam}</strong>
                  <p style={styles.smallText}>{bet.league} • {bet.tip}</p>
                  {Array.isArray(bet.markets) && (
                    <p style={styles.smallText}>Mercados IA: {bet.markets.length}</p>
                  )}
                </div>

                {bet.awayLogo && <img src={bet.awayLogo} style={styles.realLogo} />}
              </div>

              <span style={styles.badge}>Odd {bet.odd}</span>
              <span style={styles.role}>{bet.confidence}% IA</span>
              <span style={styles.status}>{bet.status}</span>

              <div style={styles.actions}>
                <button style={styles.editButton} onClick={() => startEditBet(bet)}>Editar</button>
                <button style={styles.deleteButton} onClick={() => deleteBet(bet.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Usuários cadastrados</h2>

        <div style={styles.table}>
          {users.map((user) => (
            <div key={user.id} style={styles.userRow}>
              <div>
                <strong>{user.name}</strong>
                <p style={styles.smallText}>{user.email}</p>
              </div>

              <span style={styles.badge}>{user.plan}</span>
              <span style={styles.role}>{user.role}</span>

              <div style={styles.actions}>
                <button style={styles.planButton} onClick={() => changePlan(user.id, 'Free')}>Free</button>
                <button style={styles.planButton} onClick={() => changePlan(user.id, 'Pro')}>Pro</button>
                <button style={styles.vipPlanButton} onClick={() => changePlan(user.id, 'Vip')}>Vip</button>
              </div>

              <div style={styles.actions}>
                <button style={styles.userButton} onClick={() => changeRole(user.id, 'USER')}>USER</button>
                <button style={styles.adminButton} onClick={() => changeRole(user.id, 'ADMIN')}>ADMIN</button>
              </div>

              <button style={styles.deleteButton} onClick={() => deleteUser(user.id)}>
                Excluir
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: any) {
  return (
    <div style={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    color: '#fff',
    padding: '30px',
    fontFamily: 'Arial, sans-serif',
    background: '#050505',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },

  logo: {
    width: '240px',
    height: '100px',
    objectFit: 'contain' as const,
  },

  backButton: {
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.2)',
    padding: '12px 16px',
    borderRadius: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  panel: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '24px',
    padding: '24px',
    marginBottom: '22px',
  },

  title: {
    fontSize: '38px',
    margin: 0,
  },

  subtitle: {
    color: '#c4c4c4',
  },

  sectionTitle: {
    fontSize: '26px',
    marginTop: 0,
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
    marginTop: '20px',
  },

  statCard: {
    background: 'rgba(0,0,0,.35)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },

  bestBox: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginTop: '16px',
  },

  bestCard: {
    background: 'rgba(0,0,0,.35)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },

  refreshStatsButton: {
    background: '#22c55e',
    color: '#000',
    border: 0,
    padding: '13px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  aiLogHighlight: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
    background: 'linear-gradient(135deg,rgba(34,197,94,.2),rgba(0,0,0,.35))',
    border: '1px solid rgba(34,197,94,.35)',
    borderRadius: '18px',
    padding: '16px',
    marginTop: '16px',
    marginBottom: '16px',
  },

  aiLogList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },

  aiLogRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 140px 120px 120px 120px',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(0,0,0,.35)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '16px',
    padding: '14px',
  },

  winBadge: {
    background: '#22c55e',
    color: '#000',
    padding: '8px 10px',
    borderRadius: '999px',
    textAlign: 'center' as const,
    fontWeight: 'bold',
  },

  lostBadge: {
    background: '#ef4444',
    color: '#fff',
    padding: '8px 10px',
    borderRadius: '999px',
    textAlign: 'center' as const,
    fontWeight: 'bold',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },

  input: {
    background: '#111',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.16)',
    borderRadius: '12px',
    padding: '13px',
    outline: 'none',
  },

  textarea: {
    width: '100%',
    minHeight: '110px',
    background: '#111',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.16)',
    borderRadius: '12px',
    padding: '13px',
    outline: 'none',
    resize: 'vertical' as const,
    marginBottom: '16px',
  },

  formActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },

  createButton: {
    background: '#22c55e',
    color: '#000',
    border: 0,
    padding: '13px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  cancelButton: {
    background: '#52525b',
    color: '#fff',
    border: 0,
    padding: '13px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  marketsPreview: {
    background: 'rgba(0,0,0,.35)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '18px',
    padding: '16px',
    marginBottom: '16px',
  },

  marketsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },

  marketCard: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: '14px',
    padding: '14px',
  },

  marketCategory: {
    display: 'inline-block',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },

  marketInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  realGamesTop: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap' as const,
  },

  blueButton: {
    background: '#38bdf8',
    color: '#000',
    border: 0,
    padding: '13px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  gamesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },

  gameRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 220px 90px 130px',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(0,0,0,.35)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '16px',
    padding: '14px',
  },

  realGameTeams: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  realLogo: {
    width: '42px',
    height: '42px',
    objectFit: 'contain' as const,
  },

  dateBadge: {
    background: 'rgba(56,189,248,.14)',
    color: '#38bdf8',
    border: '1px solid rgba(56,189,248,.35)',
    padding: '8px 10px',
    borderRadius: '999px',
    textAlign: 'center' as const,
    fontWeight: 'bold',
  },

  greenSmallButton: {
    background: '#22c55e',
    color: '#000',
    border: 0,
    padding: '10px 12px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  aiButton: {
    background: '#a855f7',
    color: '#fff',
    border: 0,
    padding: '10px 12px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  previewBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    background: 'rgba(0,0,0,.35)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '16px',
    padding: '14px',
    marginBottom: '16px',
  },

  previewLogo: {
    width: '58px',
    height: '58px',
    objectFit: 'contain' as const,
  },

  previewLeagueLogo: {
    width: '42px',
    height: '42px',
    objectFit: 'contain' as const,
  },

  betList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },

  betRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 100px 110px 90px 160px',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(0,0,0,.35)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '16px',
    padding: '14px',
  },

  betTeams: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  table: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },

  userRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 90px 90px 190px 170px 90px',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(0,0,0,.35)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '16px',
    padding: '14px',
  },

  smallText: {
    color: '#c4c4c4',
    margin: '5px 0 0',
  },

  badge: {
    background: '#22c55e',
    color: '#000',
    padding: '8px 10px',
    borderRadius: '999px',
    textAlign: 'center' as const,
    fontWeight: 'bold',
  },

  role: {
    background: 'rgba(255,255,255,.1)',
    color: '#fff',
    padding: '8px 10px',
    borderRadius: '999px',
    textAlign: 'center' as const,
    fontWeight: 'bold',
  },

  status: {
    background: 'rgba(255,255,255,.1)',
    color: '#fff',
    padding: '8px 10px',
    borderRadius: '999px',
    textAlign: 'center' as const,
    fontWeight: 'bold',
  },

  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },

  editButton: {
    background: '#38bdf8',
    color: '#000',
    border: 0,
    padding: '9px 11px',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  deleteButton: {
    background: '#ef4444',
    color: '#fff',
    border: 0,
    padding: '9px 11px',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  planButton: {
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.18)',
    padding: '9px 10px',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  vipPlanButton: {
    background: '#22c55e',
    color: '#000',
    border: 0,
    padding: '9px 10px',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  userButton: {
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.18)',
    padding: '9px 10px',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  adminButton: {
    background: '#facc15',
    color: '#000',
    border: 0,
    padding: '9px 10px',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  emptyBox: {
    background: 'rgba(0,0,0,.35)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '16px',
    padding: '16px',
    color: '#c4c4c4',
  },
};