import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { WhatsappWebService } from '../whatsapp-web/whatsapp-web.service';
import { FootballService } from '../football/football.service';
import { AiService } from '../ai/ai.service';
import { OddixImageService } from './oddix-image.service';
import { OddixHumanMessageService } from './oddix-human-message.service';
import { OddixVoiceService } from '../voice/oddix-voice.service';

type BetResult = 'won' | 'lost' | 'open';
type ResultReason = 'green_live' | 'green_final' | 'red_final' | 'not_finished' | 'unknown_market' | 'missing_real_stats';

type ResolvedBetResult = {
  result: BetResult;
  reason: ResultReason;
  metricName?: string;
  metricValue?: number;
  line?: number;
};

type StatTotals = {
  corners: number | null;
  shotsOnGoal: number | null;
  totalShots: number | null;
  yellowCards: number | null;
};

@Injectable()
export class ResultsCronService {
  private readonly logger = new Logger(ResultsCronService.name);
  private readonly timezone = 'America/Fortaleza';
  private lastLiveTipSentAt = 0;
  private sendingLiveTip = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
    private readonly whatsappWebService: WhatsappWebService,
    private readonly footballService: FootballService,
    private readonly aiService: AiService,
    private readonly oddixImageService: OddixImageService,
    private readonly oddixHumanMessageService: OddixHumanMessageService,
    private readonly oddixVoiceService: OddixVoiceService,
  ) {}

  private vipLink() {
    return process.env.ODDIX_VIP_LINK || '';
  }

  private estrelaBetLink() {
    return process.env.ODDIX_ESTRELABET_LINK || process.env.ESTRELABET_LINK || 'https://apretailer.com.br/click/6a2102c82bfa8143b57b86d8/182492/359080/subaccount';
  }

  private partnerBetBlock() {
    const link = this.estrelaBetLink();
    if (!link) return '';
    return [
      '',
      '🤝 *Parceria Oddix + EstrelaBet*',
      '💰 Fazer entrada / criar conta:',
      link,
      '',
      '⚠️ Jogue com responsabilidade. Aposta não é investimento. Sem all-in.',
    ].join('\n');
  }

  private async sleepRandom(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private formatDateKeyInFortaleza(date: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private todayRangeFortaleza() {
    const key = this.formatDateKeyInFortaleza(new Date());
    const start = new Date(`${key}T03:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { key, start, end };
  }

  private normalize(text: any) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(fc|sc|ec|afc|cf|club|women|woman|w|u20|u21|u23|rs)\b/g, '')
      .replace(/[^a-z0-9\s.+-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private minutesUntilGame(dateValue: any) {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor((date.getTime() - Date.now()) / 1000 / 60);
  }

  private isTodayInFortaleza(dateValue: any) {
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    return this.formatDateKeyInFortaleza(new Date()) === this.formatDateKeyInFortaleza(date);
  }

  private isFixtureActuallyLive(game: any) {
    const short = String(game?.fixture?.status?.short || '').toUpperCase();
    const long = String(game?.fixture?.status?.long || '').toLowerCase();
    const elapsed = Number(game?.fixture?.status?.elapsed || 0);
    const extra = Number(game?.fixture?.status?.extra || 0);
    const fixtureDate = game?.fixture?.date;

    if (['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST'].includes(short)) return false;
    if (long.includes('finished') || long.includes('final') || long.includes('postponed') || long.includes('cancel')) return false;
    if (elapsed >= 85) return false;
    if (extra && elapsed >= 80) return false;

    if (fixtureDate) {
      const start = new Date(fixtureDate).getTime();
      if (!Number.isNaN(start)) {
        const minutesSinceStart = Math.floor((Date.now() - start) / 1000 / 60);
        if (minutesSinceStart >= 110) return false;
      }
    }

    return ['1H', 'HT', '2H', 'LIVE', 'IN_PLAY'].includes(short) || long.includes('live') || long.includes('in play');
  }

  private isFixtureSafeForLiveTip(game: any) {
    const fixtureDate = game?.fixture?.date;
    const elapsed = Number(game?.fixture?.status?.elapsed || 0);
    const minLiveMinute = Number(process.env.ODDIX_MIN_LIVE_MINUTE || 12);
    const maxLiveMinute = Number(process.env.ODDIX_MAX_LIVE_MINUTE || 75);

    if (!this.isTodayInFortaleza(fixtureDate)) return { ok: false, reason: 'fora de hoje' };

    const untilStart = this.minutesUntilGame(fixtureDate);
    if (untilStart !== null && untilStart > 5) return { ok: false, reason: `jogo ainda não começou. faltam ${untilStart}min` };

    if (!this.isFixtureActuallyLive(game)) return { ok: false, reason: 'não está live' };
    if (elapsed < minLiveMinute) return { ok: false, reason: `muito cedo. minuto=${elapsed}` };
    if (elapsed > maxLiveMinute) return { ok: false, reason: `muito tarde. minuto=${elapsed}` };

    return { ok: true, reason: 'ok' };
  }

  private shouldSendNewLiveTipNow() {
    const cooldownMinutes = Number(process.env.ODDIX_MIN_MINUTES_BETWEEN_TIPS || 20);

    if (this.sendingLiveTip) return { ok: false, reason: 'fluxo anterior ainda enviando' };

    if (this.lastLiveTipSentAt && Date.now() - this.lastLiveTipSentAt < cooldownMinutes * 60 * 1000) {
      const remaining = Math.ceil((cooldownMinutes * 60 * 1000 - (Date.now() - this.lastLiveTipSentAt)) / 1000 / 60);
      return { ok: false, reason: `cooldown ativo. faltam ${remaining}min` };
    }

    return { ok: true, reason: 'ok' };
  }

  private isFinished(statusShort: string, statusLong: string) {
    const short = String(statusShort || '').toUpperCase();
    const long = this.normalize(statusLong);
    return ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short) || long.includes('match finished') || long.includes('finished') || long.includes('final');
  }

  private isCanceled(statusShort: string, statusLong: string) {
    const short = String(statusShort || '').toUpperCase();
    const long = this.normalize(statusLong);
    return ['PST', 'CANC', 'ABD', 'SUSP', 'INT'].includes(short) || long.includes('postponed') || long.includes('cancel');
  }

  private allowLiveGreen() {
    return String(process.env.ODDIX_ALLOW_LIVE_GREEN || 'false').toLowerCase() === 'true';
  }

  private getGoals(fixture: any) {
    const homeGoals = fixture?.goals?.home ?? fixture?.goals?.casa ?? fixture?.score?.fulltime?.home ?? fixture?.score?.fulltime?.casa ?? fixture?.score?.['tempo integral']?.home ?? fixture?.score?.['tempo integral']?.casa ?? 0;
    const awayGoals = fixture?.goals?.away ?? fixture?.goals?.fora ?? fixture?.score?.fulltime?.away ?? fixture?.score?.fulltime?.fora ?? fixture?.score?.['tempo integral']?.away ?? fixture?.score?.['tempo integral']?.fora ?? 0;

    return {
      homeGoals: Number(homeGoals || 0),
      awayGoals: Number(awayGoals || 0),
      totalGoals: Number(homeGoals || 0) + Number(awayGoals || 0),
    };
  }

  private numericStatValue(value: any): number {
    if (typeof value === 'number') return value;
    const parsed = Number(String(value ?? '0').replace('%', '').replace(',', '.'));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private getStatTotal(stats: any, possibleTypes: string[]): number | null {
    const teams = stats?.teams || [];
    if (!Array.isArray(teams) || teams.length === 0) return null;

    let found = false;
    let total = 0;
    const normalizedTypes = possibleTypes.map((type) => this.normalize(type));

    for (const team of teams) {
      for (const stat of team?.statistics || team?.stats || []) {
        const type = this.normalize(stat?.type || stat?.name || stat?.label);
        if (normalizedTypes.some((expected) => type === expected || type.includes(expected))) {
          found = true;
          total += this.numericStatValue(stat?.value ?? stat?.stat ?? stat?.val);
        }
      }
    }

    return found ? total : null;
  }

  private extractStatTotals(stats: any): StatTotals {
    if (!stats || stats.simulated === true || stats.available === false) {
      return { corners: null, shotsOnGoal: null, totalShots: null, yellowCards: null };
    }

    return {
      corners: this.getStatTotal(stats, ['Corner Kicks', 'Corners', 'Escanteios']),
      shotsOnGoal: this.getStatTotal(stats, ['Shots on Goal', 'Shots on Target', 'Chutes no Gol']),
      totalShots: this.getStatTotal(stats, ['Total Shots', 'Shots Total', 'Chutes']),
      yellowCards: this.getStatTotal(stats, ['Yellow Cards', 'Cartões Amarelos']),
    };
  }

  private parseLine(text: string) {
    const match = text.match(/(?:over|under|mais de|menos de)\s*(\d+(?:[.,]\d+)?)/i);
    if (!match) return null;
    return Number(match[1].replace(',', '.'));
  }

  private getMarketMetric(tipRaw: any, totalGoals: number, statTotals: StatTotals) {
    const tip = this.normalize(tipRaw);

    if (tip.includes('escanteio') || tip.includes('corner')) return { metricName: 'Escanteios', metricValue: statTotals.corners };
    if (tip.includes('chute no gol') || tip.includes('shots on goal') || tip.includes('shots on target') || tip.includes('sot')) return { metricName: 'Chutes no gol', metricValue: statTotals.shotsOnGoal };
    if (tip.includes('chute') || tip.includes('total shots') || tip.includes('finalizacao')) return { metricName: 'Chutes', metricValue: statTotals.totalShots };
    if (tip.includes('cartao') || tip.includes('yellow')) return { metricName: 'Cartões', metricValue: statTotals.yellowCards };

    return { metricName: 'Gols', metricValue: totalGoals };
  }


  private almostGreenEnabled() {
    return String(process.env.ODDIX_ALMOST_GREEN_ENABLED || 'true').toLowerCase() === 'true';
  }

  private almostGreenTag() {
    return 'ODDIX_ALMOST_GREEN_SENT';
  }

  private hasAlmostGreenAlreadySent(bet: any) {
    return String(bet?.analysis || '').includes(this.almostGreenTag());
  }

  private isAlmostGreenCandidate(params: {
    bet: any;
    resolved: ResolvedBetResult;
    finished: boolean;
  }) {
    if (!this.almostGreenEnabled()) {
      return { ok: false, reason: 'almost green desativado' };
    }

    if (params.finished) {
      return { ok: false, reason: 'jogo finalizado' };
    }

    if (this.hasAlmostGreenAlreadySent(params.bet)) {
      return { ok: false, reason: 'aviso já enviado' };
    }

    const tip = this.normalize(params.bet?.tip);
    const line = params.resolved.line;
    const value = Number(params.resolved.metricValue ?? NaN);
    const metricName = params.resolved.metricName || '';

    if (line === null || line === undefined || Number.isNaN(value)) {
      return { ok: false, reason: 'sem linha ou métrica real' };
    }

    const isOver = /\b(over|mais de)\b/.test(tip);
    if (!isOver) {
      return { ok: false, reason: 'não é mercado over' };
    }

    const missing = Math.ceil(line - value + 0.0001);

    if (missing !== 1) {
      return { ok: false, reason: `não está faltando 1. faltam ${missing}` };
    }

    if (value >= line) {
      return { ok: false, reason: 'já passou da linha' };
    }

    return {
      ok: true,
      reason: 'faltando 1 para bater',
      metricName,
      metricValue: value,
      line,
      missing,
    };
  }

  private createAlmostGreenText(bet: any, almost: any) {
    const metric = almost?.metricName || 'Mercado';
    const value = almost?.metricValue ?? '-';
    const line = almost?.line ?? '-';

    return [
      '👀 *ODDIX VIP | QUASE GREEN*',
      '',
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      `🎯 Entrada: ${bet.tip}`,
      `📊 ${metric}: ${value} / linha ${line}`,
      '',
      'Estamos a apenas 1 evento da confirmação.',
      'Mantenha a calma e siga a gestão.',
    ].join('\n');
  }

  private async markAlmostGreenSent(bet: any) {
    const currentAnalysis = String(bet?.analysis || '').trim();
    const tag = this.almostGreenTag();

    if (currentAnalysis.includes(tag)) return;

    await this.prisma.bet.update({
      where: { id: bet.id },
      data: {
        analysis: currentAnalysis ? `${currentAnalysis} | ${tag}` : tag,
      } as any,
    });
  }

  private async sendAlmostGreenAudioIfNeeded(params: {
    bet: any;
    resolved: ResolvedBetResult;
    finished: boolean;
  }) {
    const almost = this.isAlmostGreenCandidate(params);

    if (!almost.ok) {
      this.logger.log(
        `⏭️ Almost green não enviado ${params.bet.homeTeam} x ${params.bet.awayTeam}: ${almost.reason}`,
      );
      return;
    }

    try {
      const audio = await this.oddixVoiceService.createAudioFile({
        category: 'ALMOST_GREEN',
        homeTeam: params.bet.homeTeam,
        awayTeam: params.bet.awayTeam,
        market: params.bet.tip,
        odd: params.bet.odd,
      });

      if (audio.filePath) {
        await this.whatsappWebService.sendAudioFile({
          filePath: audio.filePath,
          target: 'vip',
          ptt: true,
        });
      } else {
        await this.whatsappWebService.sendText(this.createAlmostGreenText(params.bet, almost), 'vip');
      }

      await this.markAlmostGreenSent(params.bet);

      this.logger.log(
        `🎤 Almost green enviado: ${params.bet.homeTeam} x ${params.bet.awayTeam} | ${params.bet.tip}`,
      );
    } catch (error: any) {
      this.logger.warn(`Erro ao enviar almost green: ${error?.message || error}`);
    }
  }


  private resolveResult(params: {
    tip: string;
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    totalGoals: number;
    statTotals: StatTotals;
    finished: boolean;
  }): ResolvedBetResult {
    const tip = this.normalize(params.tip);
    const homeTeam = this.normalize(params.homeTeam);
    const awayTeam = this.normalize(params.awayTeam);
    const { homeGoals, awayGoals, totalGoals, finished, statTotals } = params;

    if (!tip) return { result: 'open', reason: 'unknown_market' };

    const isOver = /\b(over|mais de)\b/.test(tip);
    const isUnder = /\b(under|menos de)\b/.test(tip);
    const line = this.parseLine(tip);

    if ((isOver || isUnder) && line !== null) {
      const metric = this.getMarketMetric(tip, totalGoals, statTotals);
      const value = metric.metricValue;

      if (value === null || value === undefined) {
        // Correção principal: escanteio/chute/player props sem stats reais NUNCA vira RED.
        if (metric.metricName !== 'Gols') {
          return {
            result: 'open',
            reason: 'missing_real_stats',
            metricName: metric.metricName,
            metricValue: undefined,
            line,
          };
        }

        return finished
          ? { result: 'open', reason: 'unknown_market', metricName: metric.metricName, metricValue: undefined, line }
          : { result: 'open', reason: 'not_finished', metricName: metric.metricName, metricValue: undefined, line };
      }

      if (isOver && value > line) {
        if (!finished && !this.allowLiveGreen()) {
          return { result: 'open', reason: 'not_finished', metricName: metric.metricName, metricValue: value, line };
        }
        return { result: 'won', reason: finished ? 'green_final' : 'green_live', metricName: metric.metricName, metricValue: value, line };
      }

      if (isUnder && finished && value < line) {
        return { result: 'won', reason: 'green_final', metricName: metric.metricName, metricValue: value, line };
      }

      if (finished) return { result: 'lost', reason: 'red_final', metricName: metric.metricName, metricValue: value, line };
      return { result: 'open', reason: 'not_finished', metricName: metric.metricName, metricValue: value, line };
    }

    if (tip.includes('ambas equipes marcam sim') || tip.includes('ambas marcam sim') || tip.includes('btts sim')) {
      if (homeGoals > 0 && awayGoals > 0) {
        if (!finished && !this.allowLiveGreen()) return { result: 'open', reason: 'not_finished', metricName: 'Placar', metricValue: totalGoals };
        return { result: 'won', reason: finished ? 'green_final' : 'green_live', metricName: 'Placar', metricValue: totalGoals };
      }
      return finished ? { result: 'lost', reason: 'red_final', metricName: 'Placar', metricValue: totalGoals } : { result: 'open', reason: 'not_finished', metricName: 'Placar', metricValue: totalGoals };
    }

    if (tip.includes('ambas equipes marcam nao') || tip.includes('ambas marcam nao') || tip.includes('btts nao')) {
      if (!finished) return { result: 'open', reason: 'not_finished', metricName: 'Placar', metricValue: totalGoals };
      return homeGoals === 0 || awayGoals === 0
        ? { result: 'won', reason: 'green_final', metricName: 'Placar', metricValue: totalGoals }
        : { result: 'lost', reason: 'red_final', metricName: 'Placar', metricValue: totalGoals };
    }

    if (!finished) return { result: 'open', reason: 'not_finished' };

    const homeWon = homeGoals > awayGoals;
    const awayWon = awayGoals > homeGoals;
    const draw = homeGoals === awayGoals;

    if (tip.includes('ou empate') || tip.includes('dupla chance')) {
      if (tip.includes(homeTeam) || tip.includes('casa')) return { result: homeWon || draw ? 'won' : 'lost', reason: homeWon || draw ? 'green_final' : 'red_final' };
      if (tip.includes(awayTeam) || tip.includes('fora')) return { result: awayWon || draw ? 'won' : 'lost', reason: awayWon || draw ? 'green_final' : 'red_final' };
    }

    if (tip.includes('empate anula') || tip.includes('draw no bet') || tip.includes('dnb')) {
      if (draw) return { result: 'open', reason: 'unknown_market' };
      if (tip.includes(homeTeam) || tip.includes('casa')) return { result: homeWon ? 'won' : 'lost', reason: homeWon ? 'green_final' : 'red_final' };
      if (tip.includes(awayTeam) || tip.includes('fora')) return { result: awayWon ? 'won' : 'lost', reason: awayWon ? 'green_final' : 'red_final' };
    }

    return { result: 'open', reason: 'unknown_market' };
  }

  private isBlockedMarket(tipRaw: any, hasRealStats = false, isLive = false) {
    const tip = this.normalize(tipRaw);
    const line = this.parseLine(tip);

    if (!tip) return true;

    // Correção principal: bloqueia escanteio/chute/player props sem estatística real.
    if (tip.includes('escanteio') || tip.includes('corner')) return !isLive || !hasRealStats || (line !== null && line >= 8.5);
    if (tip.includes('chute no gol') || tip.includes('shots on goal') || tip.includes('sot')) return !isLive || !hasRealStats || (line !== null && line >= 5.5);
    if (tip.includes('player') || tip.includes('jogador')) return !hasRealStats;
    if (tip.includes('handicap') && !tip.includes('+0.25') && !tip.includes('+0.5') && !tip.includes('+1.5')) return true;
    if (tip.includes('cartao vermelho')) return true;

    return false;
  }

  private isQualifiedBet(bet: any, game?: any) {
    const odd = Number(bet?.odd || 0);
    const confidence = Number(bet?.confidence || 0);
    const minOdd = Number(process.env.ODDIX_MIN_ODD || 1.35);
    const maxOdd = Number(process.env.ODDIX_MAX_ODD || 2.0);
    const minConfidence = Number(process.env.ODDIX_MIN_CONFIDENCE || 75);
    const stats = game?.statistics || game?.stats || {};
    const statTotals = this.extractStatTotals(stats);
    const hasRealStats = !!stats?.available && stats?.simulated !== true && Object.values(statTotals).some((v) => v !== null);
    const isLive = this.isFixtureActuallyLive(game);

    if (!bet?.tip) return { ok: false, reason: 'sem tip' };
    if (odd < minOdd) return { ok: false, reason: `odd baixa ${odd}` };
    if (odd > maxOdd) return { ok: false, reason: `odd acima do máximo ${odd}` };
    if (confidence < minConfidence) return { ok: false, reason: `confiança baixa ${confidence}` };
    if (this.isBlockedMarket(bet.tip, hasRealStats, isLive)) return { ok: false, reason: `mercado bloqueado sem stats reais: ${bet.tip}` };

    return { ok: true, reason: 'ok' };
  }

  private async countTodayBets() {
    const { start, end } = this.todayRangeFortaleza();
    return this.prisma.bet.count({ where: { createdAt: { gte: start, lte: end } } });
  }

  private createFreeCopyMessage() {
    return [
      '👀 *ODDIX FREE*',
      '',
      'A IA encontrou um jogo interessante agora.',
      'No FREE você recebe só a amostra, sem odd e sem análise completa.',
      '',
      '🔒 No VIP tem odd, card premium, análise, gestão e entradas primeiro.',
      '👇 Aperte abaixo para virar VIP.',
      this.partnerBetBlock(),
    ].filter(Boolean).join('\n');
  }

  private createFreeTipMessage(bet: any) {
    return [
      '🔥 *ODDIX FREE | AMOSTRA*',
      '',
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      bet.league ? `🏆 ${bet.league}` : '',
      '',
      `✅ Entrada: *${bet.tip}*`,
      '',
      '🔒 Odd, confiança e análise completa saem apenas no VIP.',
      this.partnerBetBlock(),
    ].filter(Boolean).join('\n');
  }

  private createVipTipMessage(bet: any) {
    return [
      '🔥 *ODDIX VIP*',
      '',
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      bet.league ? `🏆 ${bet.league}` : '',
      '',
      `✅ Entrada: *${bet.tip}*`,
      `📈 Odd: *${bet.odd}*`,
      `🧠 Confiança: *${bet.confidence}%*`,
      `⚠️ Risco: *${bet.risk || 'Médio'}*`,
      '',
      '🤖 Entrada validada pela IA Oddix.',
      '💵 Gestão: até 1 unidade.',
      this.partnerBetBlock(),
    ].filter(Boolean).join('\n');
  }

  @Cron('*/15 * * * *')
  async sendLiveTipsAutomatically() {
    try {
      this.logger.log('🔥 ODDIX cron de palpites iniciado | modo stats reais');

      const canSend = this.shouldSendNewLiveTipNow();
      if (!canSend.ok) {
        this.logger.log(`⏭️ Anti-spam: ${canSend.reason}`);
        return;
      }

      this.sendingLiveTip = true;

      const dailyMax = Number(process.env.ODDIX_MAX_TIPS_PER_DAY || 5);
      const todayCount = await this.countTodayBets();
      if (todayCount >= dailyMax) {
        this.logger.log(`⏭️ Limite diário atingido: ${todayCount}/${dailyMax}`);
        return;
      }

      const liveGames = await this.footballService.getLiveFixtures();
      if (!liveGames?.length) {
        this.logger.log('⚠️ Nenhum jogo ao vivo encontrado.');
        return;
      }

      let sentCount = 0;
      const maxTipsPerCron = Number(process.env.ODDIX_MAX_LIVE_TIPS_PER_CRON || 1);

      for (const game of liveGames) {
        if (sentCount >= maxTipsPerCron) break;
        if (todayCount + sentCount >= dailyMax) break;

        const fixtureId = Number(game.fixture?.id || 0);
        const fixtureDate = game.fixture?.date;
        if (!fixtureId) continue;

        const liveSafety = this.isFixtureSafeForLiveTip(game);
        if (!liveSafety.ok) {
          this.logger.log(`⏭️ Palpite recusado por horário/live: fixtureId=${fixtureId} | ${liveSafety.reason}`);
          continue;
        }

        const alreadyExists = await this.prisma.bet.findFirst({ where: { fixtureId }, select: { id: true } });
        if (alreadyExists) continue;

        const homeName = String(game?.teams?.home?.name || game?.times?.home?.name || '');
        const awayName = String(game?.teams?.away?.name || game?.times?.away?.name || '');

        const duplicateByTeams = await this.prisma.bet.findFirst({
          where: {
            homeTeam: homeName,
            awayTeam: awayName,
            createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
          },
          select: { id: true },
        });

        if (duplicateByTeams) continue;

        const stats = await this.footballService.getStatistics(String(fixtureId));
        const enrichedGame = { ...game, statistics: stats };
        const bet = await this.aiService.generateBet(enrichedGame);
        const quality = this.isQualifiedBet(bet, enrichedGame);

        if (!quality.ok) {
          this.logger.log(`⏭️ Palpite recusado fixtureId=${fixtureId}: ${quality.reason}`);
          continue;
        }

        const duplicatedSameMarket = await this.prisma.bet.findFirst({
          where: {
            homeTeam: bet.homeTeam,
            awayTeam: bet.awayTeam,
            tip: bet.tip,
            createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
          },
          select: { id: true },
        });

        if (duplicatedSameMarket) continue;

        await this.prisma.bet.create({
          data: {
            fixtureId,
            homeTeam: bet.homeTeam,
            awayTeam: bet.awayTeam,
            league: bet.league,
            tip: bet.tip,
            odd: Number(bet.odd || 1),
            confidence: Number(bet.confidence || 0),
            risk: bet.risk || 'Médio',
            analysis: bet.analysis || bet.markets?.[0]?.reason || 'Entrada validada pela IA Oddix.',
            status: 'open',
            gameDate: fixtureDate ? new Date(fixtureDate) : new Date(),
            provider: game.provider || 'provider',
          } as any,
        });

        await this.oddixHumanMessageService.sendBeforeTip('vip');
        await this.sleepRandom(20_000, 45_000);

        const imagePath = await this.oddixImageService.createVipCard({
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          league: bet.league,
          market: bet.markets?.[0]?.market || 'Entrada ao vivo',
          tip: bet.tip,
          odd: bet.odd,
          confidence: bet.confidence,
          risk: bet.risk || 'Médio',
          stake: 'até 1 unidade',
          homeLogo: game.teams?.home?.logo || game.times?.home?.logo,
          awayLogo: game.teams?.away?.logo || game.times?.away?.logo,
        });

        await this.whatsappWebService.sendButtonText({
          target: 'free',
          text: this.createFreeCopyMessage(),
          buttonText: 'QUERO SER VIP',
          url: this.vipLink(),
        });

        await this.sleepRandom(20_000, 50_000);

        await this.whatsappWebService.sendButtonText({
          target: 'free',
          text: this.createFreeTipMessage(bet),
          buttonText: 'QUERO SER VIP',
          url: this.vipLink(),
        });

        await this.sleepRandom(40_000, 90_000);

        const vipMessage = this.createVipTipMessage(bet);
        if (imagePath) await this.whatsappWebService.sendImageFile({ filePath: imagePath, caption: vipMessage, target: 'vip' });
        else await this.whatsappWebService.sendText(vipMessage, 'vip');

        sentCount++;
        this.lastLiveTipSentAt = Date.now();
        this.logger.log(`✅ Palpite VIP enviado: ${bet.homeTeam} x ${bet.awayTeam} | ${bet.tip}`);
      }
    } catch (error: any) {
      this.logger.error(`Erro no cron de palpites: ${error?.message || error}`);
    } finally {
      this.sendingLiveTip = false;
    }
  }

  @Cron('*/5 * * * *')
  async checkOpenBetsResults() {
    try {
      const maxHours = Number(process.env.ODDIX_MAX_OPEN_BET_HOURS || 72);
      const openBets = await this.prisma.bet.findMany({
        where: {
          status: 'open',
          createdAt: { gte: new Date(Date.now() - maxHours * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'asc' },
        take: Number(process.env.ODDIX_RESULT_CHECK_LIMIT || 15),
      });

      for (const bet of openBets as any[]) {
        const fixtureId = String(bet.fixtureId || '');
        if (!fixtureId) continue;

        const fixture = await this.footballService.getFixtureById(fixtureId);
        if (!fixture) continue;

        const statusShort = String(fixture?.fixture?.status?.short || '');
        const statusLong = String(fixture?.fixture?.status?.long || '');
        if (this.isCanceled(statusShort, statusLong)) continue;

        const finished = this.isFinished(statusShort, statusLong);
        const stats = await this.footballService.getStatistics(fixtureId);
        const statTotals = this.extractStatTotals(stats);
        const goals = this.getGoals(fixture);

        const resolved = this.resolveResult({
          tip: bet.tip,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          homeGoals: goals.homeGoals,
          awayGoals: goals.awayGoals,
          totalGoals: goals.totalGoals,
          statTotals,
          finished,
        });

        if (resolved.result === 'open') {
          await this.sendAlmostGreenAudioIfNeeded({
            bet,
            resolved,
            finished,
          });

          this.logger.log(
            `⏳ Bet aberta ${bet.homeTeam} x ${bet.awayTeam} | ${bet.tip} | motivo=${resolved.reason} | ${resolved.metricName || ''}=${resolved.metricValue ?? 'sem stats'}`,
          );
          continue;
        }

        await this.prisma.bet.update({
          where: { id: bet.id },
          data: {
            status: resolved.result,
            result: resolved.result,
          } as any,
        });

        const resultEmoji = resolved.result === 'won' ? '✅' : '❌';
        const resultTitle = resolved.result === 'won' ? 'ODDIX GREEN' : 'ODDIX RED';
        const metricLine = resolved.metricName
          ? `📊 ${resolved.metricName}: ${resolved.metricValue ?? '-'}${resolved.line !== undefined ? ` / linha ${resolved.line}` : ''}`
          : `📊 Placar: ${goals.homeGoals}x${goals.awayGoals}`;

        const message = [
          `${resultEmoji} *${resultTitle}*`,
          '',
          `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
          `🎯 Palpite: ${bet.tip}`,
          metricLine,
          `Placar: ${goals.homeGoals}x${goals.awayGoals}`,
          '',
          `Resultado: ${resolved.result === 'won' ? 'GREEN ✅' : 'RED ❌'}`,
          `Fonte: ${stats?.source || fixture?.provider || bet.provider || 'provider'}`,
        ].join('\n');

        const audioCategory = resolved.result === 'won' ? 'GREEN' : 'RED';
        const audio = await this.oddixVoiceService.createAudioFile({
          category: audioCategory,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          market: bet.tip,
          odd: bet.odd,
        });

        if (audio.filePath) {
          await this.whatsappWebService.sendAudioFile({
            filePath: audio.filePath,
            target: 'vip',
            ptt: true,
          });
        }

        await this.whatsappWebService.sendText(message, 'vip');
        this.logger.log(`${resultEmoji} Resultado atualizado: ${bet.homeTeam} x ${bet.awayTeam} | ${bet.tip} => ${resolved.result}`);
      }
    } catch (error: any) {
      this.logger.error(`Erro ao checar resultados: ${error?.message || error}`);
    }
  }

  async syncResults(source = 'manual') {
    await this.checkOpenBetsResults();

    return {
      ok: true,
      message: 'Sincronização de resultados executada',
      source,
    };
  }

  async debugFixturesByDate(date?: string) {
    const fixtures = await this.footballService.getFixtures(date);

    return {
      ok: true,
      date: date || this.formatDateKeyInFortaleza(new Date()),
      total: fixtures?.length || 0,
      fixtures,
    };
  }

}
