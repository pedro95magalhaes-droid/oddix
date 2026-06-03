'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../../services/api';

type TabKey = 'dashboard' | 'users' | 'bets' | 'games' | 'ai' | 'system';

const emptyForm = {
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
  markets: [] as any[],
  multiples: null as any,
  analysis: '',
  risk: '',
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: any) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function safeNumber(value: any, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function statusLabel(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'won') return 'GREEN';
  if (normalized === 'lost') return 'RED';
  return 'Aberto';
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [dashboard, setDashboard] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [bets, setBets] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [gameDate, setGameDate] = useState(todayKey());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingBetId, setEditingBetId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const metrics = dashboard?.users || {};
  const betMetrics = dashboard?.bets || {};
  const system = dashboard?.system || {};

  const usersByPlan = useMemo(() => {
    return {
      free: users.filter((item) => String(item.plan).toLowerCase() === 'free').length,
      pro: users.filter((item) => String(item.plan).toLowerCase() === 'pro').length,
      vip: users.filter((item) => String(item.plan).toLowerCase() === 'vip').length,
      admin: users.filter((item) => String(item.role).toUpperCase() === 'ADMIN').length,
    };
  }, [users]);

  async function guardAdminError() {
    alert('Acesso negado. Apenas administradores.');
    window.location.href = '/dashboard';
  }

  async function loadDashboard(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      const response = await api.get('/admin/dashboard');
      setDashboard(response.data);
    } catch {
      await guardAdminError();
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const response = await api.get('/admin/users');
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch {
      await guardAdminError();
    }
  }

  async function loadBets() {
    try {
      const response = await api.get('/admin/bets');
      setBets(Array.isArray(response.data) ? response.data : []);
    } catch {
      alert('Erro ao carregar palpites.');
    }
  }

  async function loadAiLogs() {
    try {
      const response = await api.get('/admin/ai-logs');
      const logs = Array.isArray(response.data) ? response.data : response.data?.logs || [];
      setAiLogs(logs);
    } catch {
      setAiLogs([]);
    }
  }

  async function loadGames() {
    try {
      const response = await api.get(`/football/fixtures?date=${gameDate}`);
      setGames(Array.isArray(response.data) ? response.data : []);
    } catch {
      alert('Erro ao buscar jogos reais.');
    }
  }

  async function refreshAll() {
    await Promise.allSettled([loadDashboard(), loadUsers(), loadBets(), loadAiLogs()]);
  }

  useEffect(() => {
    loadDashboard(true);
    loadUsers();
    loadBets();
    loadAiLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'games' && !games.length) loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function resetForm() {
    setEditingBetId(null);
    setForm(emptyForm);
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
    setActiveTab('bets');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function generateAiBet(game: any) {
    try {
      const response = await api.post('/ai/generate-bet', {
        homeTeam: game.teams?.home?.name,
        awayTeam: game.teams?.away?.name,
        league: game.league?.name,
        leagueName: game.league?.name,
        teams: game.teams,
        fixture: game.fixture,
        goals: game.goals,
        score: game.score,
        status: game.fixture?.status,
        oddix: game.oddix,
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
        multiples: ai.multiples || null,
        analysis: ai.analysis || '',
        risk: ai.risk || '',
      });

      setActiveTab('bets');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      alert('IA gerou a entrada para este jogo.');
    } catch {
      alert('Erro ao gerar palpite com IA.');
    }
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
      multiples: bet.multiples || null,
      analysis: bet.analysis || '',
      risk: bet.risk || '',
    });
    setActiveTab('bets');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveBet() {
    if (!form.homeTeam || !form.awayTeam || !form.league || !form.tip || !form.odd || !form.confidence) {
      alert('Preencha todos os campos principais do palpite.');
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
      multiples: form.multiples,
      analysis: form.analysis,
      risk: form.risk,
    };

    try {
      setSaving(true);
      if (editingBetId) {
        await api.patch(`/admin/bets/${editingBetId}`, payload);
        alert('Palpite atualizado com sucesso.');
      } else {
        await api.post('/admin/bets', payload);
        alert('Palpite criado com sucesso.');
      }
      resetForm();
      await Promise.allSettled([loadBets(), loadDashboard()]);
    } catch {
      alert('Erro ao salvar palpite.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteBet(id: string) {
    if (!confirm('Tem certeza que deseja excluir este palpite?')) return;
    try {
      await api.delete(`/admin/bets/${id}`);
      await Promise.allSettled([loadBets(), loadDashboard()]);
    } catch {
      alert('Erro ao excluir palpite.');
    }
  }

  async function syncResults() {
    try {
      setSyncing(true);
      const response = await api.post('/admin/bets/sync-results');
      alert(
        `Resultados atualizados!\n\nVerificados: ${response.data.checked}\nGreens: ${response.data.updatedWon}\nReds: ${response.data.updatedLost}\nAinda abertos: ${response.data.stillOpen}`,
      );
      await Promise.allSettled([loadBets(), loadDashboard(), loadAiLogs()]);
    } catch {
      alert('Erro ao atualizar resultados.');
    } finally {
      setSyncing(false);
    }
  }

  async function changePlan(userId: string, plan: string) {
    try {
      await api.patch(`/admin/users/${userId}/plan`, { plan });
      await Promise.allSettled([loadUsers(), loadDashboard()]);
    } catch {
      alert('Erro ao alterar plano.');
    }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      await Promise.allSettled([loadUsers(), loadDashboard()]);
    } catch {
      alert('Erro ao alterar role.');
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm('Excluir este usuário?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      await Promise.allSettled([loadUsers(), loadDashboard()]);
    } catch {
      alert('Erro ao excluir usuário.');
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <span style={styles.kicker}>ODDIX ADMIN V2</span>
          <h1 style={styles.title}>Painel de controle</h1>
          <p style={styles.subtitle}>Usuários, crescimento, performance, palpites, IA e sistema em uma área limpa.</p>
        </div>

        <div style={styles.headerActions}>
          <button style={styles.secondaryButton} onClick={() => (window.location.href = '/dashboard')}>Dashboard</button>
          <button style={styles.primaryButton} onClick={refreshAll}>{loading ? 'Carregando...' : 'Atualizar'}</button>
        </div>
      </header>

      <nav style={styles.tabs}>
        {[
          ['dashboard', '📊 Dashboard'],
          ['users', '👥 Usuários'],
          ['bets', '⚽ Palpites'],
          ['games', '🎲 Jogos'],
          ['ai', '🤖 IA'],
          ['system', '⚙️ Sistema'],
        ].map(([key, label]) => (
          <button
            key={key}
            style={activeTab === key ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(key as TabKey)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'dashboard' && (
        <>
          <section style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <span style={styles.kicker}>CRESCIMENTO</span>
                <h2 style={styles.sectionTitle}>Usuários e conversão</h2>
              </div>
              <span style={styles.pill}>Atualizado {formatDate(dashboard?.generatedAt)}</span>
            </div>

            <div style={styles.metricsGrid}>
              <Metric label="Total usuários" value={metrics.totalUsers ?? users.length} icon="👥" />
              <Metric label="VIP" value={metrics.vipUsers ?? usersByPlan.vip} icon="💎" tone="green" />
              <Metric label="Pro" value={metrics.proUsers ?? usersByPlan.pro} icon="🚀" tone="blue" />
              <Metric label="Free" value={metrics.freeUsers ?? usersByPlan.free} icon="🆓" />
              <Metric label="Admins" value={metrics.admins ?? usersByPlan.admin} icon="👑" tone="yellow" />
              <Metric label="Cadastros hoje" value={metrics.todayUsers ?? 0} icon="📅" tone="blue" />
              <Metric label="Últimos 7 dias" value={metrics.weekUsers ?? 0} icon="📈" tone="green" />
              <Metric label="Conversão VIP/Pro" value={`${metrics.conversionRate ?? 0}%`} icon="📊" tone="purple" />
            </div>
          </section>

          <section style={styles.twoColumns}>
            <div style={styles.panel}>
              <span style={styles.kicker}>PERFORMANCE ODDIX</span>
              <h2 style={styles.sectionTitle}>Resultados</h2>
              <div style={styles.metricsGridSmall}>
                <Metric label="Palpites" value={betMetrics.totalBets ?? 0} icon="⚽" />
                <Metric label="Abertos" value={betMetrics.openBets ?? 0} icon="📂" tone="blue" />
                <Metric label="Greens" value={betMetrics.wonBets ?? 0} icon="✅" tone="green" />
                <Metric label="Reds" value={betMetrics.lostBets ?? 0} icon="❌" tone="red" />
                <Metric label="Win Rate" value={`${betMetrics.winRate ?? 0}%`} icon="🎯" tone="green" />
                <Metric label="ROI" value={`${betMetrics.roi ?? 0}%`} icon="💰" tone="yellow" />
                <Metric label="Lucro simulado" value={`R$ ${betMetrics.profit ?? 0}`} icon="📈" tone="purple" />
                <Metric label="Player Props" value={betMetrics.playerPropsBets ?? 0} icon="🎯" tone="blue" />
              </div>
              <button style={styles.greenButton} onClick={syncResults} disabled={syncing}>{syncing ? 'Sincronizando...' : 'Atualizar resultados'}</button>
            </div>

            <div style={styles.panel}>
              <span style={styles.kicker}>ÚLTIMOS CADASTROS</span>
              <h2 style={styles.sectionTitle}>Novos usuários</h2>
              <ListBox items={dashboard?.users?.latestUsers || users.slice(0, 6)} type="user" />
            </div>
          </section>
        </>
      )}

      {activeTab === 'users' && (
        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <span style={styles.kicker}>GESTÃO</span>
              <h2 style={styles.sectionTitle}>Usuários cadastrados</h2>
            </div>
            <button style={styles.primaryButton} onClick={loadUsers}>Atualizar usuários</button>
          </div>

          <div style={styles.table}>
            {users.map((user) => (
              <div key={user.id} style={styles.userRow}>
                <div>
                  <strong>{user.name}</strong>
                  <p style={styles.smallText}>{user.email}</p>
                  <p style={styles.smallText}>Cadastro: {formatDate(user.createdAt)}</p>
                </div>

                <span style={styles.badge}>{user.plan}</span>
                <span style={styles.roleBadge}>{user.role}</span>

                <div style={styles.actions}>
                  <button style={styles.miniButton} onClick={() => changePlan(user.id, 'Free')}>Free</button>
                  <button style={styles.miniButtonBlue} onClick={() => changePlan(user.id, 'Pro')}>Pro</button>
                  <button style={styles.miniButtonGreen} onClick={() => changePlan(user.id, 'Vip')}>Vip</button>
                </div>

                <div style={styles.actions}>
                  <button style={styles.miniButton} onClick={() => changeRole(user.id, 'USER')}>USER</button>
                  <button style={styles.miniButtonYellow} onClick={() => changeRole(user.id, 'ADMIN')}>ADMIN</button>
                </div>

                <button style={styles.deleteButton} onClick={() => deleteUser(user.id)}>Excluir</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'bets' && (
        <>
          <section style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <span style={styles.kicker}>{editingBetId ? 'EDIÇÃO' : 'NOVO PALPITE'}</span>
                <h2 style={styles.sectionTitle}>{editingBetId ? 'Editar palpite' : 'Criar palpite'}</h2>
              </div>
              {editingBetId && <button style={styles.secondaryButton} onClick={resetForm}>Cancelar edição</button>}
            </div>

            {(form.homeLogo || form.awayLogo || form.leagueLogo) && (
              <div style={styles.previewBox}>
                {form.leagueLogo && <img src={form.leagueLogo} style={styles.previewLeagueLogo} alt="Liga" />}
                {form.homeLogo && <img src={form.homeLogo} style={styles.previewLogo} alt="Casa" />}
                <strong>{form.homeTeam} x {form.awayTeam}</strong>
                {form.awayLogo && <img src={form.awayLogo} style={styles.previewLogo} alt="Fora" />}
              </div>
            )}

            <div style={styles.formGrid}>
              <Input label="Time casa" value={form.homeTeam} onChange={(v: string) => setForm({ ...form, homeTeam: v })} />
              <Input label="Time visitante" value={form.awayTeam} onChange={(v: string) => setForm({ ...form, awayTeam: v })} />
              <Input label="Liga" value={form.league} onChange={(v: string) => setForm({ ...form, league: v })} />
              <Input label="Entrada principal" value={form.tip} onChange={(v: string) => setForm({ ...form, tip: v })} />
              <Input label="Odd" type="number" value={form.odd} onChange={(v: string) => setForm({ ...form, odd: v })} />
              <Input label="Confiança IA" type="number" value={form.confidence} onChange={(v: string) => setForm({ ...form, confidence: v })} />
              <label style={styles.inputLabel}>Status
                <select style={styles.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="open">Aberto</option>
                  <option value="won">GREEN</option>
                  <option value="lost">RED</option>
                </select>
              </label>
              <Input label="Risco" value={form.risk} onChange={(v: string) => setForm({ ...form, risk: v })} />
              <Input label="Logo casa" value={form.homeLogo} onChange={(v: string) => setForm({ ...form, homeLogo: v })} />
              <Input label="Logo visitante" value={form.awayLogo} onChange={(v: string) => setForm({ ...form, awayLogo: v })} />
              <Input label="Logo liga" value={form.leagueLogo} onChange={(v: string) => setForm({ ...form, leagueLogo: v })} />
              <Input label="Fixture ID" value={form.fixtureId} onChange={(v: string) => setForm({ ...form, fixtureId: v })} />
            </div>

            <label style={styles.inputLabel}>Análise da IA
              <textarea style={styles.textarea} value={form.analysis} onChange={(e) => setForm({ ...form, analysis: e.target.value })} />
            </label>

            {Array.isArray(form.markets) && form.markets.length > 0 && (
              <div style={styles.marketsPreview}>
                <h3>Mercados gerados pela IA</h3>
                <div style={styles.marketsGrid}>
                  {form.markets.slice(0, 8).map((market: any, index: number) => (
                    <div key={index} style={styles.marketCard}>
                      <span style={styles.marketCategory}>{market.category || market.market}</span>
                      <strong>{market.tip || market.selection || market.market}</strong>
                      <p style={styles.smallText}>Odd {market.odd || '-'} • {market.confidence || '-'}% • {market.risk || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button style={styles.greenButton} onClick={saveBet} disabled={saving}>{saving ? 'Salvando...' : editingBetId ? 'Salvar alterações' : 'Criar palpite'}</button>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <span style={styles.kicker}>HISTÓRICO</span>
                <h2 style={styles.sectionTitle}>Palpites cadastrados</h2>
              </div>
              <button style={styles.primaryButton} onClick={loadBets}>Atualizar palpites</button>
            </div>

            <div style={styles.table}>
              {bets.map((bet) => (
                <div key={bet.id} style={styles.betRow}>
                  <div style={styles.betTeams}>
                    {bet.homeLogo && <img src={bet.homeLogo} style={styles.logoSmall} alt="Casa" />}
                    <div>
                      <strong>{bet.homeTeam} x {bet.awayTeam}</strong>
                      <p style={styles.smallText}>{bet.league} • {bet.tip}</p>
                      <p style={styles.smallText}>Criado em {formatDate(bet.createdAt)}</p>
                    </div>
                    {bet.awayLogo && <img src={bet.awayLogo} style={styles.logoSmall} alt="Fora" />}
                  </div>
                  <span style={styles.badge}>Odd {bet.odd}</span>
                  <span style={styles.roleBadge}>{bet.confidence}%</span>
                  <span style={bet.status === 'won' ? styles.winBadge : bet.status === 'lost' ? styles.lostBadge : styles.statusBadge}>{statusLabel(bet.status)}</span>
                  <div style={styles.actions}>
                    <button style={styles.editButton} onClick={() => startEditBet(bet)}>Editar</button>
                    <button style={styles.deleteButton} onClick={() => deleteBet(bet.id)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === 'games' && (
        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <span style={styles.kicker}>JOGOS REAIS</span>
              <h2 style={styles.sectionTitle}>Buscar jogos para gerar IA</h2>
            </div>
            <div style={styles.inlineActions}>
              <input style={styles.dateInput} type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
              <button style={styles.primaryButton} onClick={loadGames}>Buscar jogos</button>
            </div>
          </div>

          <div style={styles.table}>
            {games.map((game) => (
              <div key={game.fixture?.id || `${game.teams?.home?.name}-${game.teams?.away?.name}`} style={styles.gameRow}>
                <div style={styles.betTeams}>
                  <img src={game.teams?.home?.logo || '/logo-oddix-horizontal.png'} style={styles.logoSmall} alt="Casa" />
                  <div>
                    <strong>{game.teams?.home?.name} x {game.teams?.away?.name}</strong>
                    <p style={styles.smallText}>{game.league?.name} • {formatDate(game.fixture?.date)}</p>
                  </div>
                  <img src={game.teams?.away?.logo || '/logo-oddix-horizontal.png'} style={styles.logoSmall} alt="Fora" />
                </div>
                <span style={styles.badge}>Score {game.oddix?.qualityScore || '-'}</span>
                <span style={styles.roleBadge}>{game.oddix?.qualityLabel || 'normal'}</span>
                <button style={styles.editButton} onClick={() => useGame(game)}>Usar</button>
                <button style={styles.aiButton} onClick={() => generateAiBet(game)}>🤖 Gerar IA</button>
              </div>
            ))}
            {!games.length && <div style={styles.emptyBox}>Nenhum jogo encontrado. Confira cotas das APIs ou data selecionada.</div>}
          </div>
        </section>
      )}

      {activeTab === 'ai' && (
        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <span style={styles.kicker}>INTELIGÊNCIA</span>
              <h2 style={styles.sectionTitle}>Logs e automações</h2>
            </div>
            <button style={styles.primaryButton} onClick={loadAiLogs}>Atualizar IA</button>
          </div>

          {aiLogs.length ? (
            <div style={styles.table}>
              {aiLogs.map((log) => (
                <div key={log.id || JSON.stringify(log)} style={styles.logRow}>
                  <div>
                    <strong>{formatDate(log.createdAt)}</strong>
                    <p style={styles.smallText}>Origem: {log.source || '-'}</p>
                  </div>
                  <span style={styles.badge}>Verificados {log.checked || 0}</span>
                  <span style={styles.winBadge}>Greens {log.updatedWon || 0}</span>
                  <span style={styles.lostBadge}>Reds {log.updatedLost || 0}</span>
                  <span style={styles.statusBadge}>Abertos {log.stillOpen || 0}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyBox}>Logs avançados estão desativados temporariamente. O robô continua funcionando.</div>
          )}
        </section>
      )}

      {activeTab === 'system' && (
        <section style={styles.panel}>
          <span style={styles.kicker}>SISTEMA</span>
          <h2 style={styles.sectionTitle}>Status operacional</h2>
          <div style={styles.metricsGrid}>
            <Metric label="Backend" value={system.backend ? 'Online' : 'Verificar'} icon="🟢" tone="green" />
            <Metric label="WhatsApp" value={system.whatsappEnabled ? 'Ativo' : 'Off'} icon="📲" tone={system.whatsappEnabled ? 'green' : 'red'} />
            <Metric label="Voice AI" value={system.voiceEnabled ? 'Ativo' : 'Off'} icon="🎤" tone={system.voiceEnabled ? 'green' : 'red'} />
            <Metric label="Oddix TTS" value={system.ttsUrlConfigured ? 'URL OK' : 'Sem URL'} icon="🔊" tone={system.ttsUrlConfigured ? 'green' : 'red'} />
            <Metric label="Hype Engine" value={system.hypeEnabled ? 'Ativo' : 'Off'} icon="🔥" tone={system.hypeEnabled ? 'green' : 'red'} />
            <Metric label="Áudios gerados" value={system.audioHistory ?? 0} icon="🎙️" tone="purple" />
          </div>
        </section>
      )}
    </main>
  );
}

function Metric({ label, value, icon, tone = 'default' }: any) {
  const toneStyle = tone === 'green' ? styles.metricGreen : tone === 'red' ? styles.metricRed : tone === 'yellow' ? styles.metricYellow : tone === 'blue' ? styles.metricBlue : tone === 'purple' ? styles.metricPurple : styles.metric;

  return (
    <div style={{ ...styles.metric, ...toneStyle }}>
      <span style={styles.metricIcon}>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: any) {
  return (
    <label style={styles.inputLabel}>
      {label}
      <input style={styles.input} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ListBox({ items, type }: any) {
  if (!items?.length) return <div style={styles.emptyBox}>Nenhum registro ainda.</div>;

  return (
    <div style={styles.compactList}>
      {items.map((item: any) => (
        <div key={item.id} style={styles.compactRow}>
          <div>
            <strong>{type === 'user' ? item.name : `${item.homeTeam} x ${item.awayTeam}`}</strong>
            <p style={styles.smallText}>{type === 'user' ? item.email : item.tip}</p>
          </div>
          <span style={styles.roleBadge}>{type === 'user' ? item.plan : item.status}</span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top left, rgba(34,197,94,.18), transparent 34%), #050505',
    color: '#fff',
    padding: 28,
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
  },
  headerActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  kicker: { color: '#22c55e', fontWeight: 900, fontSize: 12, letterSpacing: 1.4 },
  title: { fontSize: 42, margin: '6px 0 4px' },
  subtitle: { color: '#bdbdbd', margin: 0, maxWidth: 720 },
  tabs: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 },
  tab: { background: 'rgba(255,255,255,.07)', color: '#fff', border: '1px solid rgba(255,255,255,.12)', borderRadius: 999, padding: '11px 15px', fontWeight: 800, cursor: 'pointer' },
  tabActive: { background: '#22c55e', color: '#000', border: 0, borderRadius: 999, padding: '11px 15px', fontWeight: 900, cursor: 'pointer' },
  panel: { background: 'rgba(255,255,255,.065)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 24, padding: 22, marginBottom: 20, boxShadow: '0 20px 60px rgba(0,0,0,.25)' },
  twoColumns: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, .85fr)', gap: 18 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 26, margin: '5px 0 0' },
  pill: { background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: '#d4d4d4', borderRadius: 999, padding: '8px 12px', fontSize: 12 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  metricsGridSmall: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 },
  metric: { background: 'rgba(0,0,0,.38)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  metricGreen: { borderColor: 'rgba(34,197,94,.38)', background: 'linear-gradient(135deg, rgba(34,197,94,.18), rgba(0,0,0,.35))' },
  metricRed: { borderColor: 'rgba(239,68,68,.38)', background: 'linear-gradient(135deg, rgba(239,68,68,.16), rgba(0,0,0,.35))' },
  metricYellow: { borderColor: 'rgba(250,204,21,.35)', background: 'linear-gradient(135deg, rgba(250,204,21,.14), rgba(0,0,0,.35))' },
  metricBlue: { borderColor: 'rgba(56,189,248,.35)', background: 'linear-gradient(135deg, rgba(56,189,248,.14), rgba(0,0,0,.35))' },
  metricPurple: { borderColor: 'rgba(168,85,247,.35)', background: 'linear-gradient(135deg, rgba(168,85,247,.16), rgba(0,0,0,.35))' },
  metricIcon: { fontSize: 24 },
  primaryButton: { background: '#38bdf8', color: '#000', border: 0, borderRadius: 13, padding: '12px 16px', fontWeight: 900, cursor: 'pointer' },
  secondaryButton: { background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.16)', borderRadius: 13, padding: '12px 16px', fontWeight: 800, cursor: 'pointer' },
  greenButton: { background: '#22c55e', color: '#000', border: 0, borderRadius: 13, padding: '13px 18px', fontWeight: 900, cursor: 'pointer' },
  table: { display: 'flex', flexDirection: 'column', gap: 12 },
  userRow: { display: 'grid', gridTemplateColumns: '1fr 90px 90px 190px 170px 90px', gap: 12, alignItems: 'center', background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 14 },
  betRow: { display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 160px', gap: 12, alignItems: 'center', background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 14 },
  gameRow: { display: 'grid', gridTemplateColumns: '1fr 100px 120px 90px 130px', gap: 12, alignItems: 'center', background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 14 },
  logRow: { display: 'grid', gridTemplateColumns: '1fr 140px 120px 120px 120px', gap: 12, alignItems: 'center', background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 14 },
  betTeams: { display: 'flex', alignItems: 'center', gap: 12 },
  logoSmall: { width: 42, height: 42, objectFit: 'contain' },
  smallText: { color: '#bdbdbd', margin: '4px 0 0', fontSize: 13 },
  badge: { background: '#22c55e', color: '#000', padding: '8px 10px', borderRadius: 999, textAlign: 'center', fontWeight: 900 },
  roleBadge: { background: 'rgba(255,255,255,.1)', color: '#fff', padding: '8px 10px', borderRadius: 999, textAlign: 'center', fontWeight: 800 },
  statusBadge: { background: 'rgba(255,255,255,.1)', color: '#fff', padding: '8px 10px', borderRadius: 999, textAlign: 'center', fontWeight: 800 },
  winBadge: { background: '#22c55e', color: '#000', padding: '8px 10px', borderRadius: 999, textAlign: 'center', fontWeight: 900 },
  lostBadge: { background: '#ef4444', color: '#fff', padding: '8px 10px', borderRadius: 999, textAlign: 'center', fontWeight: 900 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  miniButton: { background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10, padding: '8px 10px', fontWeight: 800, cursor: 'pointer' },
  miniButtonBlue: { background: '#38bdf8', color: '#000', border: 0, borderRadius: 10, padding: '8px 10px', fontWeight: 900, cursor: 'pointer' },
  miniButtonGreen: { background: '#22c55e', color: '#000', border: 0, borderRadius: 10, padding: '8px 10px', fontWeight: 900, cursor: 'pointer' },
  miniButtonYellow: { background: '#facc15', color: '#000', border: 0, borderRadius: 10, padding: '8px 10px', fontWeight: 900, cursor: 'pointer' },
  editButton: { background: '#38bdf8', color: '#000', border: 0, borderRadius: 10, padding: '9px 11px', fontWeight: 900, cursor: 'pointer' },
  aiButton: { background: '#a855f7', color: '#fff', border: 0, borderRadius: 10, padding: '9px 11px', fontWeight: 900, cursor: 'pointer' },
  deleteButton: { background: '#ef4444', color: '#fff', border: 0, borderRadius: 10, padding: '9px 11px', fontWeight: 900, cursor: 'pointer' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 },
  inputLabel: { display: 'flex', flexDirection: 'column', gap: 7, color: '#d4d4d4', fontSize: 13, fontWeight: 800 },
  input: { background: '#101010', color: '#fff', border: '1px solid rgba(255,255,255,.16)', borderRadius: 12, padding: 13, outline: 'none' },
  dateInput: { background: '#101010', color: '#fff', border: '1px solid rgba(255,255,255,.16)', borderRadius: 12, padding: 12, outline: 'none' },
  textarea: { minHeight: 120, background: '#101010', color: '#fff', border: '1px solid rgba(255,255,255,.16)', borderRadius: 12, padding: 13, outline: 'none', resize: 'vertical' },
  inlineActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  previewBox: { display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 14, marginBottom: 16 },
  previewLogo: { width: 58, height: 58, objectFit: 'contain' },
  previewLeagueLogo: { width: 42, height: 42, objectFit: 'contain' },
  marketsPreview: { background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: 16, marginBottom: 16 },
  marketsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  marketCard: { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 14 },
  marketCategory: { color: '#38bdf8', fontWeight: 900, fontSize: 12 },
  compactList: { display: 'flex', flexDirection: 'column', gap: 10 },
  compactRow: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 12 },
  emptyBox: { background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 16, color: '#c4c4c4' },
};
