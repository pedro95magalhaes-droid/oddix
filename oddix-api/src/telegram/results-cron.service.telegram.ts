import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../prisma/prisma.service";
import { TelegramService } from "../telegram/telegram.service";
import { WhatsappWebService } from "../whatsapp-web/whatsapp-web.service";
import { FootballService } from "../football/football.service";
import { AiService } from "../ai/ai.service";
import { OddixImageService } from "./oddix-image.service";
import { OddixHumanMessageService } from "./oddix-human-message.service";

type BetResult = "won" | "lost" | "open";
type ResultReason = "green_live" | "green_final" | "red_final" | "not_finished" | "unknown_market";

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
  private readonly timezone = "America/Fortaleza";

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
    private readonly whatsappWebService: WhatsappWebService,
    private readonly footballService: FootballService,
    private readonly aiService: AiService,
    private readonly oddixImageService: OddixImageService,
    private readonly oddixHumanMessageService: OddixHumanMessageService,
  ) {}

  private vipLink() {
    return process.env.ODDIX_VIP_LINK || "";
  }

  private async sleepRandom(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private formatDateKeyInFortaleza(date: Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: this.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  private todayRangeFortaleza() {
    const key = this.formatDateKeyInFortaleza(new Date());
    const start = new Date(`${key}T03:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { key, start, end };
  }

  private isTodayInFortaleza(dateValue: any) {
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    return this.formatDateKeyInFortaleza(new Date()) === this.formatDateKeyInFortaleza(date);
  }

  normalize(text: any) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(fc|sc|ec|afc|cf|club|women|woman|w|u20|u21|u23|rs)\b/g, "")
      .replace(/[^a-z0-9\s.+-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private isFixtureActuallyLive(game: any) {
    const short = String(game?.fixture?.status?.short || "").toUpperCase();
    const long = String(game?.fixture?.status?.long || "").toLowerCase();
    return ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "IN_PLAY"].includes(short) || long.includes("live") || long.includes("in play");
  }

  isFinished(statusShort: string, statusLong: string) {
    const short = String(statusShort || "").toUpperCase();
    const long = this.normalize(statusLong);
    return ["FT", "AET", "PEN", "AWD", "WO"].includes(short) || long.includes("match finished") || long.includes("finished");
  }

  private isCanceled(statusShort: string, statusLong: string) {
    const short = String(statusShort || "").toUpperCase();
    const long = this.normalize(statusLong);
    return ["PST", "CANC", "ABD", "SUSP", "INT"].includes(short) || long.includes("postponed") || long.includes("cancel");
  }

  private getGoals(fixture: any) {
    const homeGoals = fixture.goals?.home ?? fixture.score?.fulltime?.home ?? fixture.score?.extratime?.home ?? 0;
    const awayGoals = fixture.goals?.away ?? fixture.score?.fulltime?.away ?? fixture.score?.extratime?.away ?? 0;
    return {
      homeGoals: Number(homeGoals || 0),
      awayGoals: Number(awayGoals || 0),
      totalGoals: Number(homeGoals || 0) + Number(awayGoals || 0),
    };
  }

  private numericStatValue(value: any): number {
    if (typeof value === "number") return value;
    const parsed = Number(String(value ?? "0").replace("%", "").replace(",", "."));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private getStatTotal(stats: any, possibleTypes: string[]): number | null {
    const teams = stats?.teams || [];
    if (!Array.isArray(teams) || teams.length === 0) return null;

    let found = false;
    let total = 0;
    const normalizedTypes = possibleTypes.map((type) => this.normalize(type));

    for (const team of teams) {
      for (const stat of team?.statistics || []) {
        const type = this.normalize(stat?.type);
        if (normalizedTypes.some((expected) => type === expected || type.includes(expected))) {
          found = true;
          total += this.numericStatValue(stat?.value);
        }
      }
    }

    return found ? total : null;
  }

  private extractStatTotals(stats: any): StatTotals {
    return {
      corners: this.getStatTotal(stats, ["Corner Kicks", "Corners", "Escanteios"]),
      shotsOnGoal: this.getStatTotal(stats, ["Shots on Goal", "Shots on Target", "Chutes no Gol"]),
      totalShots: this.getStatTotal(stats, ["Total Shots", "Shots Total", "Chutes"]),
      yellowCards: this.getStatTotal(stats, ["Yellow Cards", "Cartões Amarelos"]),
    };
  }

  private parseLine(text: string) {
    const match = text.match(/(?:over|under|mais de|menos de)\s*(\d+(?:[.,]\d+)?)/i);
    if (!match) return null;
    return Number(match[1].replace(",", "."));
  }

  private getMarketMetric(tipRaw: any, totalGoals: number, statTotals: StatTotals) {
    const tip = this.normalize(tipRaw);

    if (tip.includes("escanteio") || tip.includes("corner")) {
      return { metricName: "Escanteios", metricValue: statTotals.corners };
    }

    if (tip.includes("chute no gol") || tip.includes("shots on goal") || tip.includes("shots on target") || tip.includes("sot")) {
      return { metricName: "Chutes no gol", metricValue: statTotals.shotsOnGoal };
    }

    if (tip.includes("chute") || tip.includes("total shots") || tip.includes("finalizacao")) {
      return { metricName: "Chutes", metricValue: statTotals.totalShots };
    }

    if (tip.includes("cartao") || tip.includes("yellow")) {
      return { metricName: "Cartões", metricValue: statTotals.yellowCards };
    }

    return { metricName: "Gols", metricValue: totalGoals };
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

    const homeWon = homeGoals > awayGoals;
    const awayWon = awayGoals > homeGoals;
    const draw = homeGoals === awayGoals;

    if (!tip) return { result: "open", reason: "unknown_market" };

    const isOver = /\b(over|mais de)\b/.test(tip);
    const isUnder = /\b(under|menos de)\b/.test(tip);
    const line = this.parseLine(tip);

    if ((isOver || isUnder) && line !== null) {
      const metric = this.getMarketMetric(tip, totalGoals, statTotals);
      const value = metric.metricValue;

      if (value === null || value === undefined) {
        return finished
      ? { result: "open", reason: "unknown_market", metricName: metric.metricName, metricValue: undefined, line }
    : { result: "open", reason: "not_finished", metricName: metric.metricName, metricValue: undefined, line };
      }

      if (isOver && value > line) {
        return { result: "won", reason: finished ? "green_final" : "green_live", metricName: metric.metricName, metricValue: value, line };
      }

      if (isUnder && finished && value < line) {
        return { result: "won", reason: "green_final", metricName: metric.metricName, metricValue: value, line };
      }

      if (finished) {
        return { result: "lost", reason: "red_final", metricName: metric.metricName, metricValue: value, line };
      }

      return { result: "open", reason: "not_finished", metricName: metric.metricName, metricValue: value, line };
    }

    if (tip.includes("ambas equipes marcam sim") || tip.includes("ambas marcam sim") || tip.includes("btts sim")) {
      if (homeGoals > 0 && awayGoals > 0) return { result: "won", reason: finished ? "green_final" : "green_live", metricName: "Placar", metricValue: totalGoals };
      return finished ? { result: "lost", reason: "red_final", metricName: "Placar", metricValue: totalGoals } : { result: "open", reason: "not_finished", metricName: "Placar", metricValue: totalGoals };
    }

    if (tip.includes("ambas equipes marcam nao") || tip.includes("ambas marcam nao") || tip.includes("btts nao")) {
      if (!finished) return { result: "open", reason: "not_finished", metricName: "Placar", metricValue: totalGoals };
      return homeGoals === 0 || awayGoals === 0
        ? { result: "won", reason: "green_final", metricName: "Placar", metricValue: totalGoals }
        : { result: "lost", reason: "red_final", metricName: "Placar", metricValue: totalGoals };
    }

    if (!finished) return { result: "open", reason: "not_finished" };

    if (tip.includes("ou empate") || tip.includes("dupla chance")) {
      if (tip.includes(homeTeam) || tip.includes("casa")) return { result: homeWon || draw ? "won" : "lost", reason: homeWon || draw ? "green_final" : "red_final" };
      if (tip.includes(awayTeam) || tip.includes("fora")) return { result: awayWon || draw ? "won" : "lost", reason: awayWon || draw ? "green_final" : "red_final" };
    }

    if (tip.includes("empate anula") || tip.includes("draw no bet") || tip.includes("dnb")) {
      if (draw) return { result: "open", reason: "unknown_market" };
      if (tip.includes(homeTeam) || tip.includes("casa")) return { result: homeWon ? "won" : "lost", reason: homeWon ? "green_final" : "red_final" };
      if (tip.includes(awayTeam) || tip.includes("fora")) return { result: awayWon ? "won" : "lost", reason: awayWon ? "green_final" : "red_final" };
    }

    if (tip.includes(`${homeTeam} para vencer`) || tip.includes(`${homeTeam} vence`)) {
      return { result: homeWon ? "won" : "lost", reason: homeWon ? "green_final" : "red_final" };
    }

    if (tip.includes(`${awayTeam} para vencer`) || tip.includes(`${awayTeam} vence`)) {
      return { result: awayWon ? "won" : "lost", reason: awayWon ? "green_final" : "red_final" };
    }

    return { result: "open", reason: "unknown_market" };
  }

  private isBlockedMarket(tipRaw: any) {
    const tip = this.normalize(tipRaw);
    const line = this.parseLine(tip);

    if (!tip) return true;
    if (tip.includes("escanteio") || tip.includes("corner")) return line !== null && line >= 8.5;
    if (tip.includes("chute no gol") || tip.includes("shots on goal") || tip.includes("sot")) return line !== null && line >= 5.5;
    if (tip.includes("handicap") && !tip.includes("+0.25") && !tip.includes("+0.5")) return true;
    if (tip.includes("cartao vermelho")) return true;
    return false;
  }

  private isQualifiedBet(bet: any) {
    const odd = Number(bet?.odd || 0);
    const confidence = Number(bet?.confidence || 0);
    const minOdd = Number(process.env.ODDIX_MIN_ODD || 1.4);
    const maxOdd = Number(process.env.ODDIX_MAX_ODD || 2.0);
    const minConfidence = Number(process.env.ODDIX_MIN_CONFIDENCE || 80);

    if (!bet?.tip) return { ok: false, reason: "sem tip" };
    if (odd < minOdd) return { ok: false, reason: `odd baixa ${odd}` };
    if (odd > maxOdd) return { ok: false, reason: `odd acima do máximo ${odd}` };
    if (confidence < minConfidence) return { ok: false, reason: `confiança baixa ${confidence}` };
    if (this.isBlockedMarket(bet.tip)) return { ok: false, reason: `mercado bloqueado: ${bet.tip}` };

    return { ok: true, reason: "ok" };
  }

  private async countTodayBets() {
    const { start, end } = this.todayRangeFortaleza();
    return this.prisma.bet.count({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });
  }

  private createFreeCopyMessage() {
    return [
      "👀 *ODDIX FREE*",
      "",
      "A IA encontrou uma oportunidade com odd dentro do nosso filtro.",
      "No FREE você recebe só uma amostra.",
      "",
      "🔒 No VIP tem card premium, entradas primeiro e múltipla boost.",
      "👇 Aperte abaixo para virar VIP.",
    ].join("\n");
  }

  private createFreeTipMessage(bet: any) {
    return [
      "🔥 *ODDIX FREE | AMOSTRA*",
      "",
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      bet.league ? `🏆 ${bet.league}` : "",
      "",
      `✅ Entrada: *${bet.tip}*`,
      `📈 Odd: *${bet.odd}*`,
      "",
      "🔒 A análise completa sai no VIP.",
    ].filter(Boolean).join("\n");
  }

  private createVipTipMessage(bet: any) {
    return [
      "🔥 *ODDIX VIP*",
      "",
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      bet.league ? `🏆 ${bet.league}` : "",
      "",
      `✅ Entrada: *${bet.tip}*`,
      `📈 Odd: *${bet.odd}*`,
      "",
      "🤖 Entrada validada pela IA Oddix.",
      "💵 Gestão: até 1 unidade.",
    ].filter(Boolean).join("\n");
  }

  @Cron("*/15 * * * *")
  async sendLiveTipsAutomatically() {
    try {
      this.logger.log("🔥 ODDIX cron de palpites iniciado | filtros: confiança/odd/mercado/limite diário");

      const dailyMax = Number(process.env.ODDIX_MAX_TIPS_PER_DAY || 5);
      const todayCount = await this.countTodayBets();
      if (todayCount >= dailyMax) {
        this.logger.log(`⏭️ Limite diário atingido: ${todayCount}/${dailyMax}`);
        return;
      }

      const liveGames = await this.footballService.getLiveFixtures();
      if (!liveGames?.length) {
        this.logger.log("⚠️ Nenhum jogo ao vivo encontrado.");
        return;
      }

      let sentCount = 0;
      const maxTipsPerCron = Number(process.env.ODDIX_MAX_LIVE_TIPS_PER_CRON || 1);

      for (const game of liveGames) {
        if (sentCount >= maxTipsPerCron) break;
        if ((todayCount + sentCount) >= dailyMax) break;

        const fixtureId = Number(game.fixture?.id || 0);
        const fixtureDate = game.fixture?.date;
        const statusShort = String(game.fixture?.status?.short || "").toUpperCase();

        if (!fixtureId) continue;
        if (!this.isTodayInFortaleza(fixtureDate)) continue;
        if (!this.isFixtureActuallyLive(game)) {
          this.logger.log(`⏭️ Jogo não está ao vivo: fixtureId=${fixtureId} | status=${statusShort}`);
          continue;
        }

        const alreadyExists = await this.prisma.bet.findFirst({
          where: { fixtureId },
          select: { id: true, status: true, homeTeam: true, awayTeam: true },
        });

        if (alreadyExists) {
          this.logger.log(`⏭️ Já existe palpite para fixtureId=${fixtureId} | ${alreadyExists.homeTeam} x ${alreadyExists.awayTeam}`);
          continue;
        }

        const bet = await this.aiService.generateBet(game);
        const quality = this.isQualifiedBet(bet);

        if (!quality.ok) {
          this.logger.log(`⏭️ Palpite recusado fixtureId=${fixtureId}: ${quality.reason}`);
          continue;
        }

        await this.prisma.bet.create({
          data: {
            fixtureId,
            homeTeam: bet.homeTeam,
            awayTeam: bet.awayTeam,
            league: bet.league,
            tip: bet.tip,
            odd: Number(bet.odd || 1),
            confidence: Number(bet.confidence || 0),
            risk: bet.risk || "Médio",
            analysis: bet.analysis || bet.markets?.[0]?.reason || "Entrada validada pela IA Oddix.",
            status: "open",
            gameDate: fixtureDate ? new Date(fixtureDate) : new Date(),
            provider: game.provider || "api-football",
          } as any,
        });

        const freeCopyMessage = this.createFreeCopyMessage();
        const freeMessage = this.createFreeTipMessage(bet);
        const vipMessage = this.createVipTipMessage(bet);

        await this.oddixHumanMessageService.sendBeforeTip("free");
        await this.oddixHumanMessageService.sendBeforeTip("vip");
        await this.sleepRandom(60_000, 120_000);

        const imagePath = await this.oddixImageService.createVipCard({
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          league: bet.league,
          market: bet.markets?.[0]?.market || "Entrada ao vivo",
          tip: bet.tip,
          odd: bet.odd,
          confidence: bet.confidence,
          risk: bet.risk || "Médio",
          stake: "até 1 unidade",
          homeLogo: game.teams?.home?.logo,
          awayLogo: game.teams?.away?.logo,
        });

        await this.whatsappWebService.sendButtonText({
          target: "free",
          text: freeCopyMessage,
          buttonText: "QUERO SER VIP",
          url: this.vipLink(),
        });

        await this.sleepRandom(30_000, 90_000);

        await this.whatsappWebService.sendButtonText({
          target: "free",
          text: freeMessage,
          buttonText: "QUERO SER VIP",
          url: this.vipLink(),
        });

        await this.sleepRandom(60_000, 150_000);

        if (imagePath) {
          await this.whatsappWebService.sendImageFile({ filePath: imagePath, caption: vipMessage, target: "vip" });
        } else {
          await this.whatsappWebService.sendText(vipMessage, "vip");
        }

        sentCount++;
        this.logger.log(`✅ Palpite enviado: ${bet.homeTeam} x ${bet.awayTeam} | ${bet.tip} | odd=${bet.odd}`);
      }

      if (sentCount === 0) this.logger.log("⚠️ Nenhum palpite novo aprovado pelos filtros.");
    } catch (error: any) {
      this.logger.error(`❌ Erro no cron de palpites: ${error?.message || "erro desconhecido"}`);
    }
  }

  @Cron("0 18 * * *")
  async sendVipBoostMultipleAutomatically() {
    if (String(process.env.ODDIX_VIP_MULTIPLE_ENABLED || "true").toLowerCase() !== "true") return;

    try {
      const { start, end } = this.todayRangeFortaleza();
      const tag = "ODDIX_MULTIPLE_BOOST";

      const alreadySent = await this.prisma.bet.findFirst({
        where: {
          createdAt: { gte: start, lte: end },
          analysis: { contains: tag } as any,
        },
        select: { id: true },
      });

      if (alreadySent) return;

      const liveGames = await this.footballService.getLiveFixtures();
      const selections: any[] = [];

      for (const game of liveGames || []) {
        if (selections.length >= 3) break;
        const fixtureId = Number(game.fixture?.id || 0);
        if (!fixtureId || !this.isFixtureActuallyLive(game)) continue;

        const exists = await this.prisma.bet.findFirst({ where: { fixtureId }, select: { id: true } });
        if (exists) continue;

        const bet = await this.aiService.generateBet(game);
        const quality = this.isQualifiedBet(bet);
        if (!quality.ok) continue;

        selections.push({ bet, game, fixtureId });
      }

      if (selections.length < 2) {
        this.logger.log("⏭️ Múltipla VIP não enviada: menos de 2 seleções aprovadas.");
        return;
      }

      const totalOdd = selections.reduce((acc, item) => acc * Number(item.bet.odd || 1), 1);
      const maxMultipleOdd = Number(process.env.ODDIX_MAX_MULTIPLE_ODD || 5.5);

      while (selections.length > 2 && totalOdd > maxMultipleOdd) selections.pop();

      await this.oddixHumanMessageService.sendBeforeTip("vip");
      await this.sleepRandom(60_000, 120_000);

      for (const item of selections) {
        await this.prisma.bet.create({
          data: {
            fixtureId: item.fixtureId,
            homeTeam: item.bet.homeTeam,
            awayTeam: item.bet.awayTeam,
            league: item.bet.league,
            tip: item.bet.tip,
            odd: Number(item.bet.odd || 1),
            confidence: Number(item.bet.confidence || 0),
            risk: item.bet.risk || "Médio",
            analysis: `${tag} | seleção da múltipla VIP`,
            status: "open",
            gameDate: item.game.fixture?.date ? new Date(item.game.fixture.date) : new Date(),
            provider: item.game.provider || "api-football",
          } as any,
        });
      }

      const finalOdd = selections.reduce((acc, item) => acc * Number(item.bet.odd || 1), 1).toFixed(2);
      const imagePath = await this.oddixImageService.createVipMultipleCard({
        title: "ODDIX BOOST VIP",
        oddTotal: finalOdd,
        selections: selections.map((item) => ({
          homeTeam: item.bet.homeTeam,
          awayTeam: item.bet.awayTeam,
          league: item.bet.league,
          tip: item.bet.tip,
          odd: item.bet.odd,
          homeLogo: item.game.teams?.home?.logo,
          awayLogo: item.game.teams?.away?.logo,
        })),
      });

      const caption = [
        "🚀 *ODDIX BOOST VIP*",
        "",
        ...selections.flatMap((item, index) => [
          `${index + 1}. ⚽ *${item.bet.homeTeam} x ${item.bet.awayTeam}*`,
          `✅ ${item.bet.tip}`,
          `📈 Odd: ${item.bet.odd}`,
          "",
        ]),
        `🔥 Odd total: *${finalOdd}*`,
        "💵 Gestão baixa. Múltipla é para buscar boost, não para forçar banca.",
      ].join("\n");

      if (imagePath) await this.whatsappWebService.sendImageFile({ filePath: imagePath, caption, target: "vip" });
      else await this.whatsappWebService.sendText(caption, "vip");
    } catch (error: any) {
      this.logger.error(`❌ Erro na múltipla VIP: ${error?.message || "erro desconhecido"}`);
    }
  }

  @Cron("*/5 * * * *")
  async syncResultsAutomatically() {
    return this.syncResults("auto");
  }

  private async sendWhatsappResult(params: {
    result: BetResult;
    homeTeam: string;
    awayTeam: string;
    tip: string;
    score: string;
    reason?: ResultReason;
    metricName?: string;
    metricValue?: number;
    line?: number;
  }) {
    if (params.result === "open") return;
    const isGreen = params.result === "won";
    const liveText = params.reason === "green_live" ? " antes do apito final" : "";
    const metricLine = params.metricName && params.metricValue !== undefined
      ? `📊 ${params.metricName}: *${params.metricValue}${params.line !== undefined ? ` / linha ${params.line}` : ""}*`
      : "";

    if (isGreen) {
      await this.oddixHumanMessageService.sendAfterGreen("vip");
      await this.oddixHumanMessageService.sendAfterGreen("free");
    } else {
      await this.oddixHumanMessageService.sendAfterRed("vip");
      await this.oddixHumanMessageService.sendAfterRed("free");
    }

    await this.whatsappWebService.sendButtonText({
      target: "free",
      buttonText: "QUERO SER VIP",
      url: this.vipLink(),
      text: [
        isGreen ? `✅ *GREEN ODDIX FREE${liveText.toUpperCase()}*` : "❌ *RED ODDIX FREE*",
        "",
        `⚽ ${params.homeTeam} x ${params.awayTeam}`,
        `📌 Entrada: ${params.tip}`,
        `📊 Placar: ${params.score}`,
        metricLine,
        "",
        "🔒 Próximas entradas primeiro no VIP.",
      ].filter(Boolean).join("\n"),
    });

    await this.whatsappWebService.sendText(
      [
        isGreen ? `✅🔥 *GREEN ODDIX VIP${liveText.toUpperCase()}*` : "❌⚠️ *RED ODDIX VIP*",
        "",
        `⚽ *${params.homeTeam} x ${params.awayTeam}*`,
        `📌 Entrada: *${params.tip}*`,
        `📊 Placar: *${params.score}*`,
        metricLine,
      ].filter(Boolean).join("\n"),
      "vip",
    );
  }

  async syncResults(source: "auto" | "manual" = "auto") {
    this.logger.log(`🔎 Oddix verificando GREEN/RED... origem=${source}`);

    const now = new Date();
    const minDate = new Date(now.getTime() - 1000 * 60 * 60 * 48);

    const openBets = await this.prisma.bet.findMany({
      where: {
        status: "open",
        OR: [{ gameDate: { gte: minDate } }, { createdAt: { gte: minDate } }],
      },
      orderBy: { createdAt: "desc" },
    });

    let updatedWon = 0;
    let updatedLost = 0;
    let stillOpen = 0;
    let fixtureFoundByApi = 0;
    let fixtureFoundByCache = 0;
    const details: any[] = [];

    for (const bet of openBets) {
      try {
        const baseDetail = {
          betId: bet.id,
          fixtureId: bet.fixtureId,
          game: `${bet.homeTeam} x ${bet.awayTeam}`,
          tip: bet.tip,
          status: bet.status,
          gameDate: bet.gameDate,
          createdAt: bet.createdAt,
        };

        if (!bet.fixtureId) {
          stillOpen++;
          details.push({ ...baseDetail, result: "open", reason: "Aposta sem fixtureId" });
          continue;
        }

        const fixture = await this.footballService.getFixtureById(String(bet.fixtureId));
        const stats = await this.footballService.getStatistics(String(bet.fixtureId));

        if (!fixture) {
          stillOpen++;
          details.push({ ...baseDetail, result: "open", reason: "Fixture não encontrado" });
          continue;
        }

        const foundBy = fixture?.__oddixCachedAt ? "cache_or_api" : fixture?.provider || "api";
        if (foundBy.includes("cache")) fixtureFoundByCache++; else fixtureFoundByApi++;

        const statusShort = fixture.fixture?.status?.short || "";
        const statusLong = fixture.fixture?.status?.long || "";
        const finished = this.isFinished(statusShort, statusLong);
        const canceled = this.isCanceled(statusShort, statusLong);
        const { homeGoals, awayGoals, totalGoals } = this.getGoals(fixture);
        const statTotals = this.extractStatTotals(stats);

        if (canceled) {
          stillOpen++;
          details.push({ ...baseDetail, result: "open", reason: "Jogo cancelado/suspenso. Revisar manualmente.", apiStatusShort: statusShort, apiStatusLong: statusLong });
          continue;
        }

        const resolved = this.resolveResult({
          tip: bet.tip,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          homeGoals,
          awayGoals,
          totalGoals,
          statTotals,
          finished,
        });

        if (resolved.result === "open") {
          stillOpen++;

          if (resolved.reason === "not_finished") {
            await this.oddixHumanMessageService.sendLiveUpdate("vip", {
              homeTeam: bet.homeTeam,
              awayTeam: bet.awayTeam,
              tip: bet.tip,
              score: `${homeGoals}x${awayGoals}`,
            });
          }

          details.push({
            ...baseDetail,
            fixtureId: fixture.fixture?.id || bet.fixtureId,
            result: "open",
            reason: resolved.reason === "not_finished" ? "Jogo ainda não bateu a meta e não finalizou" : "Mercado não reconhecido ou sem estatística real",
            foundBy,
            apiStatusShort: statusShort,
            apiStatusLong: statusLong,
            score: `${homeGoals}x${awayGoals}`,
            stats: statTotals,
            metricName: resolved.metricName,
            metricValue: resolved.metricValue,
            line: resolved.line,
          });
          continue;
        }

        await this.prisma.bet.update({
          where: { id: bet.id },
          data: {
            status: resolved.result,
            fixtureId: fixture.fixture?.id ? Number(fixture.fixture.id) : bet.fixtureId,
            homeScore: homeGoals,
            awayScore: awayGoals,
            statusShort,
          },
        });

        if (resolved.result === "won") updatedWon++;
        if (resolved.result === "lost") updatedLost++;

        await this.telegram.sendResultMessage({
          result: resolved.result,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          tip: bet.tip,
          score: `${homeGoals}x${awayGoals}`,
          provider: foundBy,
        });

        await this.sendWhatsappResult({
          result: resolved.result,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          tip: bet.tip,
          score: `${homeGoals}x${awayGoals}`,
          reason: resolved.reason,
          metricName: resolved.metricName,
          metricValue: resolved.metricValue,
          line: resolved.line,
        });

        details.push({
          ...baseDetail,
          fixtureId: fixture.fixture?.id || bet.fixtureId,
          result: resolved.result,
          reason: resolved.reason,
          foundBy,
          apiStatusShort: statusShort,
          apiStatusLong: statusLong,
          score: `${homeGoals}x${awayGoals}`,
          stats: statTotals,
          metricName: resolved.metricName,
          metricValue: resolved.metricValue,
          line: resolved.line,
        });
      } catch (error: any) {
        stillOpen++;
        details.push({
          betId: bet.id,
          fixtureId: bet.fixtureId,
          game: `${bet.homeTeam} x ${bet.awayTeam}`,
          tip: bet.tip,
          result: "open",
          reason: `Erro ao validar: ${error?.message || "erro desconhecido"}`,
        });
      }
    }

    await this.telegram.sendSyncSummary({ checked: openBets.length, updatedWon, updatedLost, stillOpen, source });

    return {
      message: "Debug GREEN/RED finalizado",
      checked: openBets.length,
      updatedWon,
      updatedLost,
      stillOpen,
      fixtureFoundByCache,
      fixtureFoundByApi,
      apiFootballDisabled: process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === "true",
      ignoredOldBets: "Apostas abertas com mais de 48h foram ignoradas",
      details,
    };
  }

  async debugFixturesByDate(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const cached = await this.prisma.cachedFixture.findMany({ where: { date: { gte: start, lte: end } }, orderBy: { date: "asc" } });

    return { date, cacheLength: cached.length, sample: cached.slice(0, 20).map((item) => item.raw) };
  }
}
