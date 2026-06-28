import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';

type OddixPlan = 'Free' | 'VIP' | 'PRO' | 'Premium' | 'Admin';

type DashboardBet = {
  id: string;
  match: string;
  market: string;
  stake: number;
  odd: number;
  potentialReturn: number;
  result: string;
  status?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeLogo?: string;
  awayLogo?: string;
  createdAt?: string;
};

const PREMIUM_PLANS = ['vip', 'pro', 'premium', 'admin'];

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private normalizeEmail(email?: string | null) {
    return String(email || '').trim().toLowerCase();
  }

  private envList(name: string) {
    return String(process.env[name] || '')
      .split(',')
      .map((item) => this.normalizeEmail(item))
      .filter(Boolean);
  }

  private normalizePlan(value?: string | null): OddixPlan {
    const plan = String(value || '').trim().toLowerCase();

    if (plan === 'vip') return 'VIP';
    if (plan === 'pro') return 'PRO';
    if (plan === 'premium') return 'Premium';
    if (plan === 'admin' || plan === 'owner') return 'Admin';

    return 'Free';
  }

  private effectivePlan(user: any): OddixPlan {
    const email = this.normalizeEmail(user?.email);
    const role = String(user?.role || '').trim().toLowerCase();
    const storedPlan = this.normalizePlan(user?.plan);

    if (this.envList('ODDIX_ADMIN_USERS').includes(email) || role === 'admin' || role === 'owner') {
      return 'Admin';
    }

    if (this.envList('ODDIX_PRO_USERS').includes(email)) return 'PRO';
    if (this.envList('ODDIX_VIP_USERS').includes(email)) return 'VIP';

    return storedPlan;
  }

  private isPremium(plan: string) {
    return PREMIUM_PLANS.includes(String(plan || '').trim().toLowerCase());
  }

  private buildUserPayload(user: any) {
    if (!user) return null;

    const plan = this.effectivePlan(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan,
      accessAllowed: this.isPremium(plan),
      createdAt: user.createdAt,
    };
  }

  private signUser(user: any) {
    const plan = this.effectivePlan(user);

    return this.jwtService.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan,
    });
  }

  private toNumber(value: any, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toDateLabel(value: any) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  private toDateTimeLabel(value: any) {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private resultLabel(value: any) {
    const result = String(value || '').trim().toLowerCase();
    if (['green', 'won', 'win', 'vencida', 'ganha'].includes(result)) return 'Green';
    if (['red', 'lost', 'loss', 'perdida'].includes(result)) return 'Red';
    if (['void', 'cancelada', 'cancelled', 'anulada'].includes(result)) return 'Void';
    if (['cashout', 'cash_out'].includes(result)) return 'Cashout';
    return 'Aberta';
  }

  private async findManyFromModels(modelNames: string[], argsList: any[] = []) {
    const prismaAny = this.prisma as any;

    for (const modelName of modelNames) {
      const delegate = prismaAny?.[modelName];
      if (!delegate?.findMany) continue;

      const attempts = argsList.length ? argsList : [{}];

      for (const args of attempts) {
        try {
          const rows = await delegate.findMany(args);
          if (Array.isArray(rows)) return rows;
        } catch {
          // Try the next compatible Prisma shape/model.
        }
      }
    }

    return [];
  }

  private async findFirstFromModels(modelNames: string[], argsList: any[] = []) {
    const prismaAny = this.prisma as any;

    for (const modelName of modelNames) {
      const delegate = prismaAny?.[modelName];
      if (!delegate?.findFirst) continue;

      const attempts = argsList.length ? argsList : [{}];

      for (const args of attempts) {
        try {
          const row = await delegate.findFirst(args);
          if (row) return row;
        } catch {
          // Try the next compatible Prisma shape/model.
        }
      }
    }

    return null;
  }

  private userScopedArgs(userId: string, extra: any = {}) {
    return [
      { where: { userId }, ...extra },
      { where: { user_id: userId }, ...extra },
      { where: { ownerId: userId }, ...extra },
      { where: { accountId: userId }, ...extra },
      { where: { user: { id: userId } }, ...extra },
      extra,
    ];
  }

  private firstValue(source: any, keys: string[], fallback?: any) {
    for (const key of keys) {
      const value = key.split('.').reduce((acc, part) => acc?.[part], source);
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
  }

  private normalizeBet(row: any): DashboardBet {
    const homeTeam = this.firstValue(row, ['homeTeamName', 'homeName', 'home', 'teamHome', 'fixture.homeTeam.name', 'homeTeam.name']);
    const awayTeam = this.firstValue(row, ['awayTeamName', 'awayName', 'away', 'teamAway', 'fixture.awayTeam.name', 'awayTeam.name']);
    const match = this.firstValue(row, ['match', 'matchName', 'game', 'gameName', 'eventName', 'fixture.name'], homeTeam && awayTeam ? `${homeTeam} x ${awayTeam}` : 'Aposta registrada');
    const stake = this.toNumber(this.firstValue(row, ['stake', 'amount', 'value', 'investment', 'betAmount']));
    const odd = this.toNumber(this.firstValue(row, ['odd', 'odds', 'price', 'quote']), 1);
    const potentialReturn = this.toNumber(this.firstValue(row, ['potentialReturn', 'returnValue', 'expectedReturn', 'payout']), stake * odd);

    return {
      id: String(this.firstValue(row, ['id', 'externalId', 'betId'], `${match}-${row?.createdAt || Date.now()}`)),
      match: String(match),
      market: String(this.firstValue(row, ['market', 'marketName', 'selection', 'pick', 'tip'], 'Mercado não informado')),
      stake,
      odd,
      potentialReturn,
      result: this.resultLabel(this.firstValue(row, ['result', 'status', 'state'])),
      status: this.firstValue(row, ['status', 'state']),
      homeTeam: homeTeam ? String(homeTeam) : undefined,
      awayTeam: awayTeam ? String(awayTeam) : undefined,
      homeLogo: this.firstValue(row, ['homeLogo', 'homeTeamLogo', 'homeLogoUrl', 'fixture.homeTeam.logo', 'homeTeam.logo', 'homeTeam.logoUrl']),
      awayLogo: this.firstValue(row, ['awayLogo', 'awayTeamLogo', 'awayLogoUrl', 'fixture.awayTeam.logo', 'awayTeam.logo', 'awayTeam.logoUrl']),
      createdAt: this.toDateTimeLabel(this.firstValue(row, ['placedAt', 'createdAt', 'date', 'updatedAt'])),
    };
  }

  private calculateBetProfit(row: any) {
    const explicitProfit = this.firstValue(row, ['profit', 'netProfit', 'pnl', 'resultAmount']);
    if (explicitProfit !== undefined && explicitProfit !== null) return this.toNumber(explicitProfit);

    const stake = this.toNumber(this.firstValue(row, ['stake', 'amount', 'value', 'investment', 'betAmount']));
    const odd = this.toNumber(this.firstValue(row, ['odd', 'odds', 'price', 'quote']), 1);
    const result = this.resultLabel(this.firstValue(row, ['result', 'status', 'state']));

    if (result === 'Green') return stake * Math.max(0, odd - 1);
    if (result === 'Red') return -stake;
    if (result === 'Cashout') return this.toNumber(this.firstValue(row, ['cashoutAmount', 'cashout', 'payout'])) - stake;
    return 0;
  }

  private isSettledBet(row: any) {
    return ['Green', 'Red', 'Void', 'Cashout'].includes(this.resultLabel(this.firstValue(row, ['result', 'status', 'state'])));
  }

  private dashboardStorePath() {
    return process.env.ODDIX_DASHBOARD_STORE_PATH || path.join(process.cwd(), 'data', 'oddix-dashboard-store.json');
  }

  private readDashboardStore() {
    const filePath = this.dashboardStorePath();

    try {
      if (!fs.existsSync(filePath)) {
        return { users: {} as Record<string, any> };
      }

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object') return { users: {} as Record<string, any> };
      if (!parsed.users || typeof parsed.users !== 'object') parsed.users = {};
      return parsed as { users: Record<string, any> };
    } catch {
      return { users: {} as Record<string, any> };
    }
  }

  private writeDashboardStore(store: { users: Record<string, any> }) {
    const filePath = this.dashboardStorePath();
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
  }

  private getStoredUserDashboard(userId: string) {
    const store = this.readDashboardStore();
    const current = store.users[userId] || {};

    if (!Array.isArray(current.bets)) current.bets = [];
    store.users[userId] = current;

    return { store, current };
  }

  private getStoredBets(userId: string) {
    const { current } = this.getStoredUserDashboard(userId);
    return Array.isArray(current.bets) ? current.bets : [];
  }

  private getStoredBankroll(userId: string) {
    const { current } = this.getStoredUserDashboard(userId);
    return current.bankroll || null;
  }

  private async getRawBets(userId: string) {
    const dbRows = await this.findManyFromModels(
      ['bet', 'userBet', 'oddixBet', 'bettingSlip', 'ticket', 'pick', 'entry'],
      this.userScopedArgs(userId, {
        orderBy: [{ placedAt: 'desc' }, { createdAt: 'desc' }, { updatedAt: 'desc' }],
        take: 100,
      }),
    );

    const storedRows = this.getStoredBets(userId);
    return [...storedRows, ...dbRows];
  }

  private async getRawBankroll(userId: string) {
    const dbRow = await this.findFirstFromModels(
      ['bankroll', 'userBankroll'],
      this.userScopedArgs(userId, {
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    );

    return dbRow || this.getStoredBankroll(userId);
  }

  async getDashboardBankroll(userId: string) {
    const bankroll = await this.getRawBankroll(userId);
    const overview = await this.getDashboardOverview(userId);

    return {
      bankroll,
      overview,
    };
  }

  async setDashboardBankroll(userId: string, data: any) {
    const { store, current } = this.getStoredUserDashboard(userId);
    const rawInitial = this.firstValue(data, ['initialAmount', 'initialBalance', 'startingBalance', 'amount', 'balance']);
    const rawCurrent = this.firstValue(data, ['currentAmount', 'currentBalance', 'balance']);
    const initialAmount = this.toNumber(rawInitial);
    const currentAmount = rawCurrent !== undefined && rawCurrent !== null && rawCurrent !== '' ? this.toNumber(rawCurrent) : initialAmount;

    current.bankroll = {
      id: current.bankroll?.id || `bankroll-${userId}`,
      userId,
      initialAmount,
      currentAmount,
      currency: String(data?.currency || current.bankroll?.currency || 'BRL'),
      updatedAt: new Date().toISOString(),
      createdAt: current.bankroll?.createdAt || new Date().toISOString(),
    };

    store.users[userId] = current;
    this.writeDashboardStore(store);

    return this.getDashboardOverview(userId);
  }

  async createDashboardBet(userId: string, data: any) {
    const { store, current } = this.getStoredUserDashboard(userId);
    const now = new Date().toISOString();
    const id = String(data?.id || `bet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const stake = this.toNumber(data?.stake || data?.amount || data?.value);
    const odd = this.toNumber(data?.odd || data?.odds || data?.price, 1);

    const bet = {
      id,
      userId,
      match: String(data?.match || data?.matchName || 'Aposta registrada'),
      market: String(data?.market || data?.marketName || data?.selection || 'Mercado não informado'),
      stake,
      odd,
      potentialReturn: this.toNumber(data?.potentialReturn, stake * odd),
      result: this.resultLabel(data?.result || data?.status || 'Aberta'),
      status: this.resultLabel(data?.status || data?.result || 'Aberta'),
      homeTeam: data?.homeTeam,
      awayTeam: data?.awayTeam,
      homeLogo: data?.homeLogo,
      awayLogo: data?.awayLogo,
      placedAt: data?.placedAt || now,
      createdAt: now,
      updatedAt: now,
    };

    current.bets = [bet, ...(Array.isArray(current.bets) ? current.bets : [])];
    store.users[userId] = current;
    this.writeDashboardStore(store);

    return this.normalizeBet(bet);
  }

  async updateDashboardBet(userId: string, betId: string, data: any) {
    const { store, current } = this.getStoredUserDashboard(userId);
    const bets = Array.isArray(current.bets) ? current.bets : [];
    const index = bets.findIndex((bet: any) => String(bet?.id) === String(betId));

    if (index === -1) {
      throw new NotFoundException('Aposta não encontrada');
    }

    const existing = bets[index];
    const nextResult = data?.result !== undefined || data?.status !== undefined ? this.resultLabel(data?.result || data?.status) : existing.result;
    bets[index] = {
      ...existing,
      ...data,
      result: nextResult,
      status: nextResult,
      stake: data?.stake !== undefined ? this.toNumber(data.stake) : existing.stake,
      odd: data?.odd !== undefined ? this.toNumber(data.odd, 1) : existing.odd,
      settledAt: ['Green', 'Red', 'Void', 'Cashout'].includes(nextResult) ? data?.settledAt || existing.settledAt || new Date().toISOString() : existing.settledAt,
      updatedAt: new Date().toISOString(),
    };

    current.bets = bets;
    store.users[userId] = current;
    this.writeDashboardStore(store);

    return this.normalizeBet(bets[index]);
  }

  async deleteDashboardBet(userId: string, betId: string) {
    const { store, current } = this.getStoredUserDashboard(userId);
    const bets = Array.isArray(current.bets) ? current.bets : [];
    const nextBets = bets.filter((bet: any) => String(bet?.id) !== String(betId));

    current.bets = nextBets;
    store.users[userId] = current;
    this.writeDashboardStore(store);

    return { ok: true, removed: bets.length - nextBets.length };
  }

  async register(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        plan: 'Free',
      },
    });

    const token = this.signUser(user);

    return {
      access_token: token,
      token,
      user: this.buildUserPayload(user),
    };
  }

  async login(data: any) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const passwordMatch = await bcrypt.compare(data.password, user.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const token = this.signUser(user);

    return {
      access_token: token,
      token,
      user: this.buildUserPayload(user),
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        createdAt: true,
      },
    });

    return this.buildUserPayload(user);
  }

  async updatePlan(userId: string, plan: string) {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        plan: this.normalizePlan(plan),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        createdAt: true,
      },
    });
  }

  async getDashboardOverview(userId: string) {
    const [bankroll, rawBets, snapshots] = await Promise.all([
      this.getRawBankroll(userId),
      this.getRawBets(userId),
      this.findManyFromModels(
        ['bankrollSnapshot', 'dailyPerformanceSnapshot', 'performanceSnapshot'],
        this.userScopedArgs(userId, {
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
          take: 30,
        }),
      ),
    ]);

    const settledBets = rawBets.filter((bet) => this.isSettledBet(bet));
    const openBets = rawBets.length - settledBets.length;
    const totalStake = settledBets.reduce((sum, bet) => sum + this.toNumber(this.firstValue(bet, ['stake', 'amount', 'value', 'investment', 'betAmount'])), 0);
    const profit = settledBets.reduce((sum, bet) => sum + this.calculateBetProfit(bet), 0);
    const greens = settledBets.filter((bet) => this.resultLabel(this.firstValue(bet, ['result', 'status', 'state'])) === 'Green').length;
    const reds = settledBets.filter((bet) => this.resultLabel(this.firstValue(bet, ['result', 'status', 'state'])) === 'Red').length;
    const initialBalance = this.toNumber(this.firstValue(bankroll, ['initialAmount', 'initialBalance', 'startingBalance', 'amount', 'balance']), 0);
    const explicitBalance = this.firstValue(bankroll, ['currentAmount', 'currentBalance', 'balance', 'amount']);
    const balance = explicitBalance !== undefined && explicitBalance !== null ? this.toNumber(explicitBalance) : initialBalance + profit;
    const avgOdd = rawBets.length ? rawBets.reduce((sum, bet) => sum + this.toNumber(this.firstValue(bet, ['odd', 'odds', 'price', 'quote']), 1), 0) / rawBets.length : 0;
    const bankrollHistory = snapshots.length
      ? snapshots.map((snapshot) => ({
          label: this.toDateLabel(this.firstValue(snapshot, ['date', 'createdAt'])) || 'Dia',
          value: this.toNumber(this.firstValue(snapshot, ['bankroll', 'balance', 'currentAmount', 'value'])),
        }))
      : this.buildBankrollHistoryFromBets(rawBets, initialBalance || balance);

    return {
      balance,
      initialBalance,
      profit,
      roi: totalStake > 0 ? (profit / totalStake) * 100 : 0,
      winRate: greens + reds > 0 ? (greens / (greens + reds)) * 100 : 0,
      totalBets: rawBets.length,
      openBets,
      settledBets: settledBets.length,
      avgOdd,
      bankrollHistory,
    };
  }

  private buildBankrollHistoryFromBets(rawBets: any[], initialBalance: number) {
    const settled = rawBets
      .filter((bet) => this.isSettledBet(bet))
      .sort((a, b) => {
        const da = new Date(this.firstValue(a, ['settledAt', 'updatedAt', 'createdAt', 'placedAt']) || 0).getTime();
        const db = new Date(this.firstValue(b, ['settledAt', 'updatedAt', 'createdAt', 'placedAt']) || 0).getTime();
        return da - db;
      });

    if (!settled.length) return [];

    let running = initialBalance;
    const points: Array<{ label: string; value: number }> = [];

    for (const bet of settled) {
      running += this.calculateBetProfit(bet);
      points.push({
        label: this.toDateLabel(this.firstValue(bet, ['settledAt', 'updatedAt', 'createdAt', 'placedAt'])) || `#${points.length + 1}`,
        value: Number(running.toFixed(2)),
      });
    }

    return points.slice(-14);
  }

  private normalizeDashboardGameRow(row: any, index = 0) {
    const homeTeam = this.firstValue(row, ['homeTeamName', 'homeName', 'home', 'teamHome', 'homeTeam.name'], 'Mandante');
    const awayTeam = this.firstValue(row, ['awayTeamName', 'awayName', 'away', 'teamAway', 'awayTeam.name'], 'Visitante');

    return {
      id: String(this.firstValue(row, ['id', 'externalId'], `${homeTeam}-${awayTeam}-${index}`)),
      league: this.firstValue(row, ['league', 'competition', 'tournament', 'competitionName', 'leagueName'], 'Futebol'),
      status: this.firstValue(row, ['status', 'state', 'matchStatus'], 'Sem status'),
      minute: this.firstValue(row, ['minute', 'elapsed', 'matchMinute']),
      kickoff: this.toDateTimeLabel(this.firstValue(row, ['kickoff', 'startTime', 'date', 'matchDate'])),
      score: this.firstValue(row, ['score', 'scoreText', 'result']),
      confidence: this.toNumber(this.firstValue(row, ['confidence', 'scoreConfidence', 'probability']), 0),
      homeTeam: String(homeTeam),
      awayTeam: String(awayTeam),
      homeLogo: this.firstValue(row, ['homeLogo', 'homeTeamLogo', 'homeLogoUrl', 'homeTeam.logo', 'homeTeam.logoUrl']),
      awayLogo: this.firstValue(row, ['awayLogo', 'awayTeamLogo', 'awayLogoUrl', 'awayTeam.logo', 'awayTeam.logoUrl']),
      topMarket: this.firstValue(row, ['topMarket', 'market', 'bestMarket', 'recommendation']),
      topOdd: this.firstValue(row, ['topOdd', 'odd', 'odds', 'bestOdd']),
    };
  }

  private espnCompetitionSlugs() {
    return String(process.env.ODDIX_DASHBOARD_ESPN_LEAGUES || 'fifa.world,bra.1,eng.1,esp.1,ita.1,ger.1,fra.1,por.1,usa.1')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private scoreFromEspnCompetition(competition: any) {
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const home = competitors.find((item: any) => item?.homeAway === 'home') || competitors[0];
    const away = competitors.find((item: any) => item?.homeAway === 'away') || competitors[1];
    const homeScore = home?.score;
    const awayScore = away?.score;

    if (homeScore === undefined || awayScore === undefined || homeScore === null || awayScore === null) return undefined;
    return `${homeScore} x ${awayScore}`;
  }

  private normalizeEspnEvent(event: any, slug: string, index = 0) {
    const competition = Array.isArray(event?.competitions) ? event.competitions[0] : null;
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const home = competitors.find((item: any) => item?.homeAway === 'home') || competitors[0];
    const away = competitors.find((item: any) => item?.homeAway === 'away') || competitors[1];
    const status = competition?.status || event?.status || {};
    const statusType = status?.type || {};
    const statusName = statusType?.shortDetail || statusType?.detail || status?.displayClock || 'Sem status';
    const displayClock = status?.displayClock;
    const period = status?.period;
    const isLive = Boolean(statusType?.state === 'in' || statusType?.name === 'STATUS_IN_PROGRESS');
    const isFinal = Boolean(statusType?.state === 'post' || statusType?.completed);
    const kickoff = event?.date || competition?.date;
    const score = this.scoreFromEspnCompetition(competition);
    const homeName = home?.team?.displayName || home?.team?.shortDisplayName || home?.team?.name || 'Mandante';
    const awayName = away?.team?.displayName || away?.team?.shortDisplayName || away?.team?.name || 'Visitante';

    return {
      id: String(event?.id || `${slug}-${homeName}-${awayName}-${index}`),
      league: event?.league?.name || event?.league?.abbreviation || slug,
      status: isLive ? 'Ao vivo' : isFinal ? 'Encerrado' : statusName,
      minute: displayClock ? `${displayClock}${period ? ` • ${period}º tempo` : ''}` : undefined,
      kickoff: this.toDateTimeLabel(kickoff),
      score,
      confidence: 0,
      homeTeam: String(homeName),
      awayTeam: String(awayName),
      homeLogo: home?.team?.logo || home?.team?.logos?.[0]?.href,
      awayLogo: away?.team?.logo || away?.team?.logos?.[0]?.href,
      topMarket: undefined,
      topOdd: undefined,
      source: 'espn-public-scoreboard',
    };
  }

  private sortDashboardGames(games: any[]) {
    const weight = (game: any) => {
      const status = String(game?.status || '').toLowerCase();
      if (status.includes('ao vivo')) return 0;
      if (status.includes('pré') || status.includes('pre')) return 1;
      if (status.includes('encerrado') || status.includes('final')) return 3;
      return 2;
    };

    return games.sort((a, b) => weight(a) - weight(b));
  }

  private async fetchEspnPublicGames() {
    const fetchFn = (globalThis as any).fetch;
    if (!fetchFn) return [];

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 4500) : null;

    try {
      const slugs = this.espnCompetitionSlugs();
      const results = await Promise.all(
        slugs.map(async (slug) => {
          try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(slug)}/scoreboard`;
            const response = await fetchFn(url, {
              headers: {
                accept: 'application/json',
                'user-agent': 'OddixDashboard/1.0',
              },
              signal: controller?.signal,
            });

            if (!response?.ok) return [];
            const data = await response.json();
            const events = Array.isArray(data?.events) ? data.events : [];
            return events.map((event: any, index: number) => this.normalizeEspnEvent(event, slug, index));
          } catch {
            return [];
          }
        }),
      );

      const seen = new Set<string>();
      const merged = results.flat().filter((game: any) => {
        const key = `${game.homeTeam}-${game.awayTeam}-${game.kickoff || game.score || game.status}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return this.sortDashboardGames(merged).slice(0, 40);
    } catch {
      return [];
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async getDashboardGames(_userId: string) {
    const rows = await this.findManyFromModels(
      ['dashboardGame', 'game', 'match', 'fixture', 'footballMatch'],
      [
        { orderBy: [{ kickoff: 'asc' }, { startTime: 'asc' }, { createdAt: 'desc' }], take: 40 },
        { orderBy: [{ createdAt: 'desc' }], take: 40 },
        { take: 40 },
      ],
    );

    if (rows.length) {
      return rows.map((row: any, index: number) => this.normalizeDashboardGameRow(row, index));
    }

    return this.fetchEspnPublicGames();
  }

  async getDashboardBets(userId: string) {
    const rows = await this.getRawBets(userId);
    return rows.map((row) => this.normalizeBet(row));
  }

  async getDashboardPlayers(_userId: string) {
    const rows = await this.findManyFromModels(
      ['dashboardPlayer', 'playerStat', 'player', 'footballPlayer'],
      [
        { orderBy: [{ score: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }], take: 30 },
        { take: 30 },
      ],
    );

    return rows.map((row: any, index: number) => ({
      id: String(this.firstValue(row, ['id', 'externalId'], `${row?.name || 'player'}-${index}`)),
      name: String(this.firstValue(row, ['name', 'playerName', 'fullName'], 'Jogador')),
      team: this.firstValue(row, ['team', 'teamName', 'club', 'team.name']),
      teamLogo: this.firstValue(row, ['teamLogo', 'teamLogoUrl', 'clubLogo', 'team.logo', 'team.logoUrl']),
      score: this.toNumber(this.firstValue(row, ['score', 'rating', 'index', 'value']), 0),
      trend: this.firstValue(row, ['trend', 'tag', 'label', 'category']),
      metric: this.firstValue(row, ['metric', 'stat', 'description', 'note']),
    }));
  }

  async getDashboardMarkets(_userId: string) {
    const rows = await this.findManyFromModels(
      ['dashboardMarket', 'marketStat', 'market', 'bettingMarket'],
      [
        { orderBy: [{ edge: 'desc' }, { winRate: 'desc' }, { createdAt: 'desc' }], take: 30 },
        { take: 30 },
      ],
    );

    return rows.map((row: any, index: number) => ({
      id: String(this.firstValue(row, ['id', 'externalId'], `${row?.name || 'market'}-${index}`)),
      name: String(this.firstValue(row, ['name', 'market', 'marketName'], 'Mercado')),
      edge: this.toNumber(this.firstValue(row, ['edge', 'score', 'value', 'rating', 'winRate']), 0),
      volume: this.toNumber(this.firstValue(row, ['volume', 'count', 'total', 'entries']), 0),
      winRate: this.toNumber(this.firstValue(row, ['winRate', 'hitRate']), 0),
      note: this.firstValue(row, ['note', 'description', 'hint']),
    }));
  }

  async getDashboardCompliance(_userId: string) {
    return [
      { title: '18+', description: 'Conteúdo exclusivo para maiores de 18 anos.' },
      { title: 'Jogo responsável', description: 'Aposte com controle e consciência.' },
      { title: 'Sem promessa de lucro', description: 'Análises, odds e estatísticas não garantem resultado.' },
      { title: 'Aposta não é investimento', description: 'Aposte apenas como entretenimento e nunca como fonte de renda.' },
      { title: 'Controle de banca', description: 'Defina limite de stake, valor diário e exposição máxima.' },
      { title: 'Não recupere perdas', description: 'Não use novas apostas para tentar recuperar prejuízos anteriores.' },
    ];
  }


  private marketTemplatesForGame(game: any) {
    const home = String(game?.homeTeam || 'Mandante');
    const away = String(game?.awayTeam || 'Visitante');
    const status = String(game?.status || '').toLowerCase();
    const isLive = status.includes('ao vivo');
    const isScheduled = status.includes('pré') || status.includes('pre') || status.includes('scheduled');
    const base = isLive ? 4 : isScheduled ? 2 : 0;

    return [
      {
        market: `${home} ou empate`,
        type: 'Dupla chance',
        risk: 'seguro',
        confidence: Math.min(88, 72 + base),
        reason: 'Mercado de proteção, reduzindo exposição ao resultado seco.',
      },
      {
        market: 'Under 3.5 gols',
        type: 'Gols',
        risk: 'seguro',
        confidence: Math.min(84, 69 + base),
        reason: 'Linha conservadora para jogos com leitura mais protegida.',
      },
      {
        market: 'Over 1.5 gols',
        type: 'Gols',
        risk: 'moderado',
        confidence: Math.min(82, 66 + base),
        reason: 'Entrada moderada quando o jogo apresenta potencial mínimo ofensivo.',
      },
      {
        market: 'Ambas marcam',
        type: 'Gols',
        risk: 'moderado',
        confidence: Math.min(76, 59 + base),
        reason: `Mercado depende de volume ofensivo dos dois lados: ${home} e ${away}.`,
      },
      {
        market: 'Mais de 7.5 escanteios',
        type: 'Escanteios',
        risk: 'ousado',
        confidence: Math.min(70, 54 + base),
        reason: 'Mercado mais sensível ao ritmo, pressão territorial e estilo de ataque.',
      },
      {
        market: `${home} vence`,
        type: 'Resultado',
        risk: 'ousado',
        confidence: Math.min(68, 51 + base),
        reason: 'Resultado seco tem maior variância e deve ser usado com stake menor.',
      },
    ];
  }

  private normalizeGeneratedPick(game: any, template: any, index: number) {
    const homeTeam = String(game?.homeTeam || 'Mandante');
    const awayTeam = String(game?.awayTeam || 'Visitante');
    const match = `${homeTeam} x ${awayTeam}`;
    const hasOdd = game?.topOdd !== undefined && game?.topOdd !== null && game?.topOdd !== '' && Number(game?.topOdd) > 1;

    return {
      id: `${String(game?.id || match).replace(/[^a-zA-Z0-9_-]/g, '-')}-${index}`,
      gameId: String(game?.id || ''),
      match,
      league: game?.league || 'Futebol',
      status: game?.status || 'Sem status',
      minute: game?.minute,
      score: game?.score,
      homeTeam,
      awayTeam,
      homeLogo: game?.homeLogo,
      awayLogo: game?.awayLogo,
      market: template.market,
      type: template.type,
      risk: template.risk,
      confidence: template.confidence,
      odd: hasOdd && template.type === 'Resultado' ? this.toNumber(game.topOdd, 0) : null,
      oddStatus: hasOdd && template.type === 'Resultado' ? 'odd disponível' : 'odd indisponível',
      reason: template.reason,
      source: 'oddix-picks-engine',
      generatedAt: new Date().toISOString(),
    };
  }

  private buildPicksFromGames(games: any[], limit = 80) {
    const picks: any[] = [];

    for (const game of games || []) {
      const templates = this.marketTemplatesForGame(game);
      templates.forEach((template, index) => picks.push(this.normalizeGeneratedPick(game, template, index)));
    }

    return picks
      .sort((a, b) => this.toNumber(b.confidence) - this.toNumber(a.confidence))
      .slice(0, limit);
  }

  private buildMultipleFromPicks(picks: any[], risk: string, size: number) {
    const normalizedRisk = String(risk || 'segura').toLowerCase();
    const wantedRisk = normalizedRisk.includes('ous') ? 'ousado' : normalizedRisk.includes('mod') ? 'moderado' : 'seguro';
    const filtered = picks.filter((pick) => String(pick.risk || '').toLowerCase() === wantedRisk);
    const base = filtered.length >= size ? filtered : picks;
    const selected: any[] = [];
    const usedMatches = new Set<string>();

    for (const pick of base) {
      if (usedMatches.has(pick.match)) continue;
      selected.push(pick);
      usedMatches.add(pick.match);
      if (selected.length >= size) break;
    }

    const confidence = selected.length
      ? Math.round(selected.reduce((sum, pick) => sum + this.toNumber(pick.confidence), 0) / selected.length)
      : 0;
    const odds = selected.map((pick) => this.toNumber(pick.odd, 0)).filter((odd) => odd > 1);
    const estimatedOdd = odds.length === selected.length && selected.length
      ? Number(odds.reduce((acc, odd) => acc * odd, 1).toFixed(2))
      : null;

    return {
      id: `multiple-${wantedRisk}-${selected.map((pick) => pick.id).join('-')}`.slice(0, 120),
      title: wantedRisk === 'seguro' ? 'Múltipla segura' : wantedRisk === 'moderado' ? 'Múltipla moderada' : 'Múltipla ousada',
      risk: wantedRisk,
      confidence,
      estimatedOdd,
      oddStatus: estimatedOdd ? 'odd calculada com dados disponíveis' : 'odds indisponíveis para cálculo completo',
      legs: selected,
      size: selected.length,
      generatedAt: new Date().toISOString(),
      note: 'Sugestão estatística para análise. Não há garantia de resultado.',
    };
  }

  async getDashboardPicks(userId: string) {
    const games = await this.getDashboardGames(userId);
    return this.buildPicksFromGames(games);
  }

  async generateDashboardPicks(userId: string) {
    return this.getDashboardPicks(userId);
  }

  async getDashboardMultiples(userId: string) {
    const picks = await this.getDashboardPicks(userId);

    return [
      this.buildMultipleFromPicks(picks, 'segura', 3),
      this.buildMultipleFromPicks(picks, 'moderada', 3),
      this.buildMultipleFromPicks(picks, 'ousada', 4),
    ].filter((multiple) => multiple.legs.length > 0);
  }

  async generateDashboardMultiple(userId: string, data: any) {
    const picks = await this.getDashboardPicks(userId);
    const risk = String(data?.risk || 'segura');
    const size = Math.max(2, Math.min(6, this.toNumber(data?.size, risk.toLowerCase().includes('ous') ? 4 : 3)));

    return this.buildMultipleFromPicks(picks, risk, size);
  }

  async createDashboardBetFromPick(userId: string, data: any) {
    const pick = data?.pick || data;
    const stake = this.toNumber(data?.stake || pick?.stake || 0);
    const odd = this.toNumber(data?.odd || pick?.odd || 1, 1);

    return this.createDashboardBet(userId, {
      match: pick?.match,
      market: pick?.market,
      stake,
      odd,
      result: 'Aberta',
      potentialReturn: stake * odd,
      homeTeam: pick?.homeTeam,
      awayTeam: pick?.awayTeam,
      homeLogo: pick?.homeLogo,
      awayLogo: pick?.awayLogo,
      source: 'pick',
      pickId: pick?.id,
    });
  }

  async getDashboard(userId: string) {
    const user = await this.me(userId);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const [overview, games, bets, players, markets, compliance, picks, multiples] = await Promise.all([
      this.getDashboardOverview(userId),
      this.getDashboardGames(userId),
      this.getDashboardBets(userId),
      this.getDashboardPlayers(userId),
      this.getDashboardMarkets(userId),
      this.getDashboardCompliance(userId),
      this.getDashboardPicks(userId),
      this.getDashboardMultiples(userId),
    ]);

    return {
      user,
      access: {
        allowed: user.accessAllowed,
        plan: user.plan,
        status: user.accessAllowed ? 'acesso liberado' : 'plano sem acesso',
      },
      overview,
      games,
      bets,
      players,
      markets,
      compliance,
      picks,
      multiples,
      source: 'backend-real-endpoints',
    };
  }

  async getAdminDashboard(actorUserId: string) {
    const actor = await this.me(actorUserId);

    if (!actor || this.normalizePlan(actor.plan) !== 'Admin') {
      throw new ForbiddenException('Acesso administrativo necessário');
    }

    const users = await this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        createdAt: true,
      },
    });

    const normalizedUsers = users.map((user) => this.buildUserPayload(user));
    const planCounts = normalizedUsers.reduce((acc: Record<string, number>, user: any) => {
      const plan = String(user?.plan || 'Free');
      acc[plan] = (acc[plan] || 0) + 1;
      return acc;
    }, {});

    return {
      actor,
      totalUsers: normalizedUsers.length,
      premiumUsers: normalizedUsers.filter((user: any) => user?.accessAllowed).length,
      blockedUsers: normalizedUsers.filter((user: any) => !user?.accessAllowed).length,
      planCounts,
      users: normalizedUsers,
    };
  }

  async adminUpdateUserPlan(actorUserId: string, targetUserId: string, plan: string) {
    const actor = await this.me(actorUserId);

    if (!actor || this.normalizePlan(actor.plan) !== 'Admin') {
      throw new ForbiddenException('Acesso administrativo necessário');
    }

    const normalizedPlan = this.normalizePlan(plan);

    const updatedUser = await this.prisma.user.update({
      where: {
        id: targetUserId,
      },
      data: {
        plan: normalizedPlan,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        createdAt: true,
      },
    });

    return this.buildUserPayload(updatedUser);
  }
}
