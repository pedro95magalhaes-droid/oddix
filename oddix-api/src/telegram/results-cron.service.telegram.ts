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
type GroupType = "free" | "vip";

type LiveStats = {
  cornersHome: number;
  cornersAway: number;
  cornersTotal: number;
  shotsOnGoalHome: number;
  shotsOnGoalAway: number;
  shotsOnGoalTotal: number;
  shotsTotalHome: number;
  shotsTotalAway: number;
  shotsTotal: number;
  yellowCardsHome: number;
  yellowCardsAway: number;
  yellowCardsTotal: number;
};

type ResolvedBet = {
  result: BetResult;
  reason: string;
  metricName?: string;
  metricValue?: number;
  line?: number;
};

@Injectable()
export class ResultsCronService {
  private readonly logger = new Logger(ResultsCronService.name);
  private readonly apiFootballURL = "https://v3.football.api-sports.io";
  private readonly timezone = "America/Fortaleza";
  private readonly lastDirectMessageAt = new Map<string, number>();

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

  private minOdd() {
    return Number(process.env.ODDIX_MIN_ODD || 1.4);
  }

  private maxOdd() {
    return Number(process.env.ODDIX_MAX_ODD || 2.0);
  }

  private minConfidence() {
    return Number(process.env.ODDIX_MIN_CONFIDENCE || 80);
  }

  private maxFreeTipsPerDay() {
    return Number(process.env.ODDIX_FREE_MAX_TIPS_PER_DAY || 3);
  }

  private maxVipTipsPerDay() {
    return Number(process.env.ODDIX_VIP_MAX_TIPS_PER_DAY || 5);
  }

  private minMinutesBetweenTips() {
    return Number(process.env.ODDIX_MIN_MINUTES_BETWEEN_TIPS || 25);
  }

  private minMsBetweenDirectMessages(group: GroupType) {
    return group === "free"
      ? Number(process.env.ODDIX_FREE_DIRECT_INTERVAL_MS || 10 * 60 * 1000)
      : Number(process.env.ODDIX_VIP_DIRECT_INTERVAL_MS || 8 * 60 * 1000);
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

  private isTodayInFortaleza(dateValue: any) {
    if (!dateValue) return false;

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;

    const todayKey = this.formatDateKeyInFortaleza(new Date());
    const fixtureKey = this.formatDateKeyInFortaleza(date);

    return todayKey === fixtureKey;
  }

  private dayRangeFortaleza() {
    const now = new Date();
    const key = this.formatDateKeyInFortaleza(now);
    return {
      key,
      start: new Date(`${key}T00:00:00.000-03:00`),
      end: new Date(`${key}T23:59:59.999-03:00`),
    };
  }

  private normalize(text: any) {
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
    return ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "IN_PLAY"].includes(short);
  }

  private isFinished(statusShort: string, statusLong: string) {
    const short = this.normalize(statusShort);
    const long = this.normalize(statusLong);

    return (
      ["ft", "aet", "pen", "awd", "wo"].includes(short) ||
      long.includes("match finished") ||
      long.includes("finished") ||
      long.includes("after extra time") ||
      long.includes("after penalties")
    );
  }

  private inferFinishedByTime(fixture: any, bet?: any) {
    const statusShort = String(fixture?.fixture?.status?.short || "").toUpperCase();
    const elapsed = Number(fixture?.fixture?.status?.elapsed || 0);
    const fixtureDate = fixture?.fixture?.date || bet?.gameDate;
    const betCreatedAt = bet?.createdAt;

    if (["FT", "AET", "PEN", "AWD", "WO"].includes(statusShort)) {
      return true;
    }

    // Cache velho da API às vezes fica preso como 2H/85+.
    // Se já está no fim do 2º tempo, trata como encerrado para resolver GREEN/RED.
    if (statusShort === "2H" && elapsed >= 85) {
      return true;
    }

    // Segurança pelo horário real de início do jogo.
    if (fixtureDate) {
      const start = new Date(fixtureDate).getTime();

      if (!Number.isNaN(start)) {
        const minutesSinceStart = Math.floor((Date.now() - start) / 1000 / 60);

        if (minutesSinceStart >= 115) {
          return true;
        }
      }
    }

    // Segurança pela idade da aposta.
    if (betCreatedAt) {
      const created = new Date(betCreatedAt).getTime();

      if (!Number.isNaN(created)) {
        const minutesSinceBet = Math.floor((Date.now() - created) / 1000 / 60);

        if (minutesSinceBet >= 120) {
          return true;
        }
      }
    }

    return false;
  }

  private shouldSendLiveUpdate(fixture: any, bet?: any) {
    const statusShort = String(fixture?.fixture?.status?.short || "").toUpperCase();
    const elapsed = Number(fixture?.fixture?.status?.elapsed || 0);
    const fixtureDate = fixture?.fixture?.date || bet?.gameDate;
    const betCreatedAt = bet?.createdAt;

    if (!["1H", "HT", "2H", "LIVE", "IN_PLAY"].includes(statusShort)) {
      return false;
    }

    if (statusShort === "2H" && elapsed >= 80) {
      return false;
    }

    if (fixtureDate) {
      const start = new Date(fixtureDate).getTime();

      if (!Number.isNaN(start)) {
        const minutesSinceStart = Math.floor((Date.now() - start) / 1000 / 60);

        if (minutesSinceStart >= 105) {
          return false;
        }
      }
    }

    if (betCreatedAt) {
      const created = new Date(betCreatedAt).getTime();

      if (!Number.isNaN(created)) {
        const minutesSinceBet = Math.floor((Date.now() - created) / 1000 / 60);

        if (minutesSinceBet >= 80) {
          return false;
        }
      }
    }

    return true;
  }

  private getGoals(fixture: any) {
    const homeGoals =
      fixture.goals?.home ??
      fixture.score?.fulltime?.home ??
      fixture.score?.extratime?.home ??
      0;

    const awayGoals =
      fixture.goals?.away ??
      fixture.score?.fulltime?.away ??
      fixture.score?.extratime?.away ??
      0;

    return {
      homeGoals: Number(homeGoals || 0),
      awayGoals: Number(awayGoals || 0),
      totalGoals: Number(homeGoals || 0) + Number(awayGoals || 0),
    };
  }

  private numberValue(value: any) {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    const parsed = Number(String(value).replace("%", "").replace(",", ".").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private emptyStats(): LiveStats {
    return {
      cornersHome: 0,
      cornersAway: 0,
      cornersTotal: 0,
      shotsOnGoalHome: 0,
      shotsOnGoalAway: 0,
      shotsOnGoalTotal: 0,
      shotsTotalHome: 0,
      shotsTotalAway: 0,
      shotsTotal: 0,
      yellowCardsHome: 0,
      yellowCardsAway: 0,
      yellowCardsTotal: 0,
    };
  }

  private extractStats(statistics: any): LiveStats {
    const stats = this.emptyStats();
    const rows = Array.isArray(statistics?.response)
      ? statistics.response
      : Array.isArray(statistics)
        ? statistics
        : Array.isArray(statistics?.data)
          ? statistics.data
          : [];

    const readTeam = (index: number, typeNames: string[]) => {
      const team = rows[index];
      const items = team?.statistics || [];
      const found = items.find((item: any) =>
        typeNames.some((name) => this.normalize(item?.type).includes(this.normalize(name))),
      );
      return this.numberValue(found?.value);
    };

    stats.cornersHome = readTeam(0, ["Corner Kicks", "Corners", "Escanteios"]);
    stats.cornersAway = readTeam(1, ["Corner Kicks", "Corners", "Escanteios"]);
    stats.cornersTotal = stats.cornersHome + stats.cornersAway;

    stats.shotsOnGoalHome = readTeam(0, ["Shots on Goal", "Shots on target", "Chutes no gol"]);
    stats.shotsOnGoalAway = readTeam(1, ["Shots on Goal", "Shots on target", "Chutes no gol"]);
    stats.shotsOnGoalTotal = stats.shotsOnGoalHome + stats.shotsOnGoalAway;

    stats.shotsTotalHome = readTeam(0, ["Total Shots", "Shots", "Chutes"]);
    stats.shotsTotalAway = readTeam(1, ["Total Shots", "Shots", "Chutes"]);
    stats.shotsTotal = stats.shotsTotalHome + stats.shotsTotalAway;

    stats.yellowCardsHome = readTeam(0, ["Yellow Cards", "Cartões amarelos", "Cartoes amarelos"]);
    stats.yellowCardsAway = readTeam(1, ["Yellow Cards", "Cartões amarelos", "Cartoes amarelos"]);
    stats.yellowCardsTotal = stats.yellowCardsHome + stats.yellowCardsAway;

    return stats;
  }

  private async getFixtureStats(fixtureId: any): Promise<LiveStats> {
    if (!fixtureId) return this.emptyStats();

    try {
      const data = await this.footballService.getStatistics(String(fixtureId));
      return this.extractStats(data);
    } catch (error: any) {
      this.logger.warn(`⚠️ Falha ao buscar estatísticas fixtureId=${fixtureId}: ${error?.message || "erro"}`);
      return this.emptyStats();
    }
  }

  private getLine(tip: string) {
    const normalized = this.normalize(tip).replace(/,/g, ".");
    const match = normalized.match(/(?:over|under|mais de|menos de)\s*(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  private isBlockedMarket(tip: any, market?: any) {
    const text = this.normalize(`${market || ""} ${tip || ""}`);
    const line = this.getLine(text);

    if (text.includes("escante") || text.includes("corner")) {
      if (line !== null && line >= 8.5) return true;
    }

    if (text.includes("chutes no gol") || text.includes("shots on goal") || text.includes("sot")) {
      if (line !== null && line >= 5.5) return true;
    }

    if (text.includes("handicap") && /[-+]\s*[12](\.\d+)?/.test(text)) return true;
    if (text.includes("cartao vermelho") || text.includes("red card")) return true;
    if (text.includes("placar exato") || text.includes("correct score")) return true;
    if (text.includes("primeiro marcador") || text.includes("first goalscorer")) return true;

    return false;
  }

  private qualityBetAllowed(bet: any) {
    const odd = Number(bet?.odd || 0);
    const confidence = Number(String(bet?.confidence ?? 0).replace("%", ""));
    const market = bet?.markets?.[0]?.market || bet?.market || "";

    if (!bet?.tip) return { ok: false, reason: "sem tip" };
    if (!Number.isFinite(odd) || odd < this.minOdd()) return { ok: false, reason: `odd abaixo de ${this.minOdd()}` };
    if (!Number.isFinite(confidence) || confidence < this.minConfidence()) {
      return { ok: false, reason: `confiança abaixo de ${this.minConfidence()}%` };
    }

    // Regra Oddix Confidence Engine:
    // odd acima do teto padrão só é liberada quando a IA classifica como ELITE/ABSURDO.
    if (odd > this.maxOdd() && confidence < 90) {
      return { ok: false, reason: `odd acima de ${this.maxOdd()} exige confiança 90+` };
    }
    if (odd > 2.3 && confidence < 95) {
      return { ok: false, reason: "odd acima de 2.30 exige nível ABSURDO" };
    }
    if (this.isBlockedMarket(bet.tip, market)) return { ok: false, reason: "mercado agressivo bloqueado" };

    return { ok: true, reason: "aprovado" };
  }

  private async countTodayOpenOrSentBets() {
    const { start, end } = this.dayRangeFortaleza();
    return this.prisma.bet.count({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });
  }

  private async hasRecentBet() {
    const since = new Date(Date.now() - this.minMinutesBetweenTips() * 60 * 1000);
    const recent = await this.prisma.bet.findFirst({
      where: { createdAt: { gte: since } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return !!recent;
  }

  private createFreeCopyMessage() {
    return [
      "👀 *Família Oddix, apareceu uma oportunidade.*",
      "",
      "A IA analisou o jogo e encontrou valor dentro dos filtros.",
      "No FREE você recebe só uma amostra.",
      "",
      "🔒 No VIP você recebe:",
      "✅ entradas primeiro",
      "✅ card premium",
      "✅ múltipla boost",
      "✅ acompanhamento até GREEN/RED",
      "",
      "👇 Aperte abaixo para virar VIP.",
    ].join("\n");
  }

  private createFreeTipMessage(bet: any) {
    return [
      "🔥 *ODDIX FREE | AMOSTRA*",
      "",
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      `🏆 ${bet.league}`,
      "",
      `✅ Entrada: *${bet.tip}*`,
      `📈 Odd alvo: *${bet.odd}*`,
      "",
      "🔒 A leitura completa e as próximas entradas ficam no VIP.",
    ].join("\n");
  }

  private createVipTipMessage(bet: any) {
    const level = bet.engineLevel || bet.sources?.engineLevel || (Number(bet.confidence || 0) >= 95 ? "ABSURDO" : Number(bet.confidence || 0) >= 90 ? "ELITE" : Number(bet.confidence || 0) >= 85 ? "FORTE" : "BOM");
    const score = bet.engineScore || bet.confidence;
    const category = bet.engineCategory || (Number(bet.odd || 0) >= 2.2 ? "BOOST" : "SAFE");
    const dominance = bet.dominanceHome !== undefined && bet.dominanceAway !== undefined
      ? `📊 Dominância IA: *${bet.dominanceHome}% x ${bet.dominanceAway}%*`
      : "";

    return [
      `🔥 *ODDIX LIVE AI | ${level}*`,
      "",
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      `🏆 ${bet.league}`,
      "",
      dominance,
      `🏷️ Categoria: *${category}*`,
      `🎯 Score IA: *${score}/100*`,
      "",
      `✅ Entrada: *${bet.tip}*`,
      `📈 Odd alvo: *${bet.odd}*`,
      `🧠 Confiança: *${bet.confidence}%*`,
      `⚠️ Risco: *${bet.risk || "Médio"}*`,
      "",
      "🚨 A IA encontrou valor real dentro dos filtros do Oddix.",
      "💵 Gestão: 0.5 a 1 unidade. Sem emoção, só método.",
    ].filter(Boolean).join("\n");
  }

  private async sendDirectText(group: GroupType, text: string) {
    const key = `${group}:direct`;
    const now = Date.now();
    const last = this.lastDirectMessageAt.get(key) || 0;
    if (now - last < this.minMsBetweenDirectMessages(group)) {
      this.logger.log(`⏭️ Mensagem direta bloqueada por intervalo: ${group}`);
      return;
    }
    this.lastDirectMessageAt.set(key, now);
    await this.whatsappWebService.sendText(text, group);
  }

  @Cron("*/15 * * * *")
  async sendLiveTipsAutomatically() {
    try {
      this.logger.log("🔥 ODDIX cron de palpites ao vivo iniciado... filtros ativos | odd 1.40-2.00 | confiança 80+");

      const totalToday = await this.countTodayOpenOrSentBets();
      if (totalToday >= this.maxVipTipsPerDay()) {
        this.logger.log(`⏭️ Limite diário VIP atingido: ${totalToday}/${this.maxVipTipsPerDay()}`);
        return;
      }

      if (await this.hasRecentBet()) {
        this.logger.log(`⏭️ Pulando cron: última entrada enviada há menos de ${this.minMinutesBetweenTips()} min`);
        return;
      }

      const liveGames = await this.footballService.getLiveFixtures();
      if (!liveGames?.length) {
        this.logger.log("⚠️ Nenhum jogo ao vivo encontrado para enviar palpite.");
        return;
      }

      let sentCount = 0;
      const maxTipsPerCron = Number(process.env.ODDIX_MAX_LIVE_TIPS_PER_CRON || 1);

      for (const game of liveGames) {
        if (sentCount >= maxTipsPerCron) break;

        const fixtureId = Number(game.fixture?.id || 0);
        const fixtureDate = game.fixture?.date;
        const statusShort = String(game.fixture?.status?.short || "").toUpperCase();

        if (!fixtureId) continue;
        if (!this.isTodayInFortaleza(fixtureDate)) continue;
        if (!this.isFixtureActuallyLive(game)) {
          this.logger.log(`⏭️ Pulando jogo que não está ao vivo: fixtureId=${fixtureId} | status=${statusShort}`);
          continue;
        }

        const alreadyExists = await this.prisma.bet.findFirst({
          where: { fixtureId },
          select: { id: true, status: true, homeTeam: true, awayTeam: true },
        });

        if (alreadyExists) {
          this.logger.log(`⚠️ Palpite já existe fixtureId=${fixtureId} | ${alreadyExists.homeTeam} x ${alreadyExists.awayTeam}`);
          continue;
        }

        const bet = await this.aiService.generateBet(game);
        const quality = this.qualityBetAllowed(bet);
        if (!quality.ok) {
          this.logger.log(`⏭️ Palpite reprovado fixtureId=${fixtureId}: ${quality.reason}`);
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
            analysis: bet.analysis || "Entrada validada pela IA Oddix.",
            status: "open",
            gameDate: fixtureDate ? new Date(fixtureDate) : new Date(),
            provider: game.provider || "api-football",
          } as any,
        });

        await this.oddixHumanMessageService.sendBeforeTip("free");
        await this.oddixHumanMessageService.sendBeforeTip("vip");
        await this.sleepRandom(45_000, 90_000);

        const imagePath = await this.oddixImageService.createVipCard({
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          league: bet.league,
          market: bet.markets?.[0]?.market || "Entrada ao vivo",
          tip: bet.tip,
          odd: bet.odd,
          confidence: bet.confidence,
          risk: bet.risk || "Médio",
          stake: "0.5 a 1 unidade",
          homeLogo: game.teams?.home?.logo,
          awayLogo: game.teams?.away?.logo,
          status: "AO VIVO",
          elapsed: game.fixture?.status?.elapsed,
        });

        const todayTotalAfterCreate = await this.countTodayOpenOrSentBets();
        if (todayTotalAfterCreate <= this.maxFreeTipsPerDay()) {
          await this.whatsappWebService.sendButtonText({
            target: "free",
            text: this.createFreeCopyMessage(),
            buttonText: "QUERO SER VIP",
            url: this.vipLink(),
          });
          await this.sleepRandom(25_000, 60_000);
          await this.whatsappWebService.sendButtonText({
            target: "free",
            text: this.createFreeTipMessage(bet),
            buttonText: "QUERO SER VIP",
            url: this.vipLink(),
          });
        }

        await this.sleepRandom(45_000, 90_000);

        if (imagePath) {
          await this.whatsappWebService.sendImageFile({
            filePath: imagePath,
            caption: this.createVipTipMessage(bet),
            target: "vip",
          });
        } else {
          await this.whatsappWebService.sendText(this.createVipTipMessage(bet), "vip");
        }

        sentCount++;
        this.logger.log(`✅ Palpite enviado com filtros: ${bet.homeTeam} x ${bet.awayTeam} | ${bet.tip} | odd=${bet.odd}`);
      }
    } catch (error: any) {
      this.logger.error(`❌ Erro no cron de palpites: ${error?.message || "erro desconhecido"}`);
    }
  }

  @Cron("0 18 * * *")
  async sendVipMultipleAutomatically() {
    try {
      if (String(process.env.ODDIX_ENABLE_VIP_MULTIPLE || "true").toLowerCase() !== "true") return;

      const { start, end } = this.dayRangeFortaleza();
      const already = await this.prisma.bet.findFirst({
        where: {
          createdAt: { gte: start, lte: end },
          analysis: { contains: "ODDIX_MULTIPLA_VIP" },
        } as any,
        select: { id: true },
      });
      if (already) return;

      const liveGames = await this.footballService.getLiveFixtures();
      const legs: any[] = [];

      for (const game of liveGames || []) {
        if (legs.length >= 3) break;
        const fixtureId = Number(game.fixture?.id || 0);
        if (!fixtureId || !this.isTodayInFortaleza(game.fixture?.date)) continue;
        if (!this.isFixtureActuallyLive(game)) continue;

        const exists = await this.prisma.bet.findFirst({ where: { fixtureId }, select: { id: true } });
        if (exists) continue;

        const bet = await this.aiService.generateBet(game);
        const quality = this.qualityBetAllowed(bet);
        if (!quality.ok) continue;

        legs.push({ game, bet, fixtureId });
      }

      if (legs.length < 2) {
        this.logger.log("⏭️ Múltipla VIP não enviada: menos de 2 pernas aprovadas.");
        return;
      }

      const oddTotal = legs.reduce((acc, item) => acc * Number(item.bet.odd || 1), 1);
      if (oddTotal < 2.5 || oddTotal > 6) {
        this.logger.log(`⏭️ Múltipla VIP bloqueada por odd total=${oddTotal.toFixed(2)}`);
        return;
      }

      await Promise.all(
        legs.map((item) =>
          this.prisma.bet.create({
            data: {
              fixtureId: item.fixtureId,
              homeTeam: item.bet.homeTeam,
              awayTeam: item.bet.awayTeam,
              league: item.bet.league,
              tip: item.bet.tip,
              odd: Number(item.bet.odd || 1),
              confidence: Number(item.bet.confidence || 0),
              risk: item.bet.risk || "Médio",
              analysis: "ODDIX_MULTIPLA_VIP | Perna da múltipla VIP diária.",
              status: "open",
              gameDate: item.game.fixture?.date ? new Date(item.game.fixture.date) : new Date(),
              provider: item.game.provider || "api-football",
            } as any,
          }),
        ),
      );

      const imagePath = await (this.oddixImageService as any).createVipMultipleCard?.({
        legs: legs.map((item) => ({
          homeTeam: item.bet.homeTeam,
          awayTeam: item.bet.awayTeam,
          league: item.bet.league,
          tip: item.bet.tip,
          odd: item.bet.odd,
          homeLogo: item.game.teams?.home?.logo,
          awayLogo: item.game.teams?.away?.logo,
        })),
        oddTotal: oddTotal.toFixed(2),
      });

      const caption = [
        "🚀 *ODDIX BOOST VIP | MÚLTIPLA*",
        "",
        ...legs.flatMap((item, index) => [
          `${index + 1}. ⚽ *${item.bet.homeTeam} x ${item.bet.awayTeam}*`,
          `✅ ${item.bet.tip}`,
          `📈 Odd ${item.bet.odd}`,
          "",
        ]),
        `🔥 *Odd total: ${oddTotal.toFixed(2)}*`,
        "",
        "Gestão: múltipla é sempre mão menor.",
      ].join("\n");

      if (imagePath) {
        await this.whatsappWebService.sendImageFile({ filePath: imagePath, caption, target: "vip" });
      } else {
        await this.whatsappWebService.sendText(caption, "vip");
      }
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar múltipla VIP: ${error?.message || "erro desconhecido"}`);
    }
  }

  @Cron("*/5 * * * *")
  async syncResultsAutomatically() {
    return this.syncResults("auto");
  }

  async getCachedFixtureById(fixtureId: any) {
    if (!fixtureId) return null;
    const cached = await this.prisma.cachedFixture.findUnique({ where: { fixtureId: String(fixtureId) } });
    return cached?.raw || null;
  }

  async fetchApiFootball(apiKey: string, path: string, params: Record<string, any>) {
    const url = new URL(`${this.apiFootballURL}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), { headers: { "x-apisports-key": apiKey } });
    return response.json();
  }

  async fetchFixtureById(apiKey: string, fixtureId: number) {
    try {
      if (process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === "true") return null;
      const data = await this.fetchApiFootball(apiKey, "/fixtures", { id: fixtureId, timezone: this.timezone });
      return data?.response?.[0] || null;
    } catch (error: any) {
      this.logger.warn(`⚠️ API-Football fixtureId=${fixtureId} falhou: ${error?.message || "erro"}`);
      return null;
    }
  }

  private resolveResult(params: {
    tip: string;
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    totalGoals: number;
    stats: LiveStats;
    finished: boolean;
  }): ResolvedBet {
    const tip = this.normalize(params.tip);
    const homeTeam = this.normalize(params.homeTeam);
    const awayTeam = this.normalize(params.awayTeam);
    const { homeGoals, awayGoals, totalGoals, stats, finished } = params;

    const homeWon = homeGoals > awayGoals;
    const awayWon = awayGoals > homeGoals;
    const draw = homeGoals === awayGoals;

    if (!tip) return { result: "open", reason: "Palpite vazio" };

    const line = this.getLine(tip);
    const isOver = tip.includes("over") || tip.includes("mais de");
    const isUnder = tip.includes("under") || tip.includes("menos de");

    let metricName = "gols";
    let metricValue = totalGoals;

    if (tip.includes("escante") || tip.includes("corner")) {
      metricName = "escanteios";
      metricValue = stats.cornersTotal;
    } else if (tip.includes("chutes no gol") || tip.includes("shots on goal") || tip.includes("sot")) {
      metricName = "chutes no gol";
      metricValue = stats.shotsOnGoalTotal;
    } else if (tip.includes("chutes") || tip.includes("shots")) {
      metricName = "chutes";
      metricValue = stats.shotsTotal;
    } else if (tip.includes("cartoes") || tip.includes("cartao") || tip.includes("cards")) {
      metricName = "cartões amarelos";
      metricValue = stats.yellowCardsTotal;
    }

    if (line !== null && isOver) {
      if (metricValue > line) {
        return { result: "won", reason: `GREEN antecipado: ${metricName} ${metricValue} > ${line}`, metricName, metricValue, line };
      }
      if (finished) {
        return { result: "lost", reason: `Jogo finalizado: ${metricName} ${metricValue} <= ${line}`, metricName, metricValue, line };
      }
      return { result: "open", reason: `Aguardando bater: ${metricName} ${metricValue}/${line + 0.5}`, metricName, metricValue, line };
    }

    if (line !== null && isUnder) {
      if (metricValue > line) {
        return { result: "lost", reason: `RED antecipado: ${metricName} ${metricValue} > ${line}`, metricName, metricValue, line };
      }
      if (finished) {
        return { result: "won", reason: `Jogo finalizado: ${metricName} ${metricValue} < ${line}`, metricName, metricValue, line };
      }
      return { result: "open", reason: `Under ainda vivo: ${metricName} ${metricValue}/${line}`, metricName, metricValue, line };
    }

    if (tip.includes("ambas equipes marcam sim") || tip.includes("ambas marcam sim") || tip.includes("btts sim")) {
      if (homeGoals > 0 && awayGoals > 0) return { result: "won", reason: "GREEN antecipado: ambas marcaram" };
      if (finished) return { result: "lost", reason: "Jogo finalizado sem ambas marcarem" };
      return { result: "open", reason: "Aguardando ambas marcarem" };
    }

    if (tip.includes("ambas equipes marcam nao") || tip.includes("ambas marcam nao") || tip.includes("btts nao")) {
      if (homeGoals > 0 && awayGoals > 0) return { result: "lost", reason: "RED antecipado: ambas marcaram" };
      if (finished) return { result: "won", reason: "GREEN: uma ou nenhuma equipe marcou" };
      return { result: "open", reason: "BTTS não ainda vivo" };
    }

    if (!finished) return { result: "open", reason: "Mercado depende do final do jogo" };

    if (tip.includes("ou empate") || tip.includes("dupla chance")) {
      if (tip.includes(homeTeam)) return { result: homeWon || draw ? "won" : "lost", reason: "Dupla chance resolvida" };
      if (tip.includes(awayTeam)) return { result: awayWon || draw ? "won" : "lost", reason: "Dupla chance resolvida" };
    }

    if (tip.includes("empate anula") || tip.includes("draw no bet") || tip.includes("dnb")) {
      if (draw) return { result: "open", reason: "Empate anula: aposta sem resultado no sistema" };
      if (tip.includes(homeTeam)) return { result: homeWon ? "won" : "lost", reason: "Empate anula resolvido" };
      if (tip.includes(awayTeam)) return { result: awayWon ? "won" : "lost", reason: "Empate anula resolvido" };
    }

    if (tip.includes("+0.25")) {
      if (tip.includes(homeTeam)) return { result: homeWon || draw ? "won" : "lost", reason: "Handicap leve resolvido" };
      if (tip.includes(awayTeam)) return { result: awayWon || draw ? "won" : "lost", reason: "Handicap leve resolvido" };
    }

    if (tip.includes(`${homeTeam} para vencer`) || tip.includes(`${homeTeam} vence`)) {
      return { result: homeWon ? "won" : "lost", reason: "Vencedor resolvido" };
    }

    if (tip.includes(`${awayTeam} para vencer`) || tip.includes(`${awayTeam} vence`)) {
      return { result: awayWon ? "won" : "lost", reason: "Vencedor resolvido" };
    }

    return { result: "open", reason: "Mercado não reconhecido" };
  }

  private async sendWhatsappResult(params: {
    result: BetResult;
    homeTeam: string;
    awayTeam: string;
    tip: string;
    score: string;
    reason?: string;
    metricName?: string;
    metricValue?: number;
  }) {
    if (params.result === "open") return;
    const isGreen = params.result === "won";

    if (isGreen) {
      await this.oddixHumanMessageService.sendAfterGreen("vip");
      await this.oddixHumanMessageService.sendAfterGreen("free");
    } else {
      await this.oddixHumanMessageService.sendAfterRed("vip");
      await this.oddixHumanMessageService.sendAfterRed("free");
    }

    const metricLine = params.metricName
      ? `📊 ${params.metricName}: *${params.metricValue ?? 0}*`
      : "";

    await this.whatsappWebService.sendButtonText({
      target: "free",
      buttonText: "QUERO SER VIP",
      url: this.vipLink(),
      text: [
        isGreen ? "✅ *GREEN ODDIX FREE*" : "❌ *RED ODDIX FREE*",
        "",
        `⚽ ${params.homeTeam} x ${params.awayTeam}`,
        `📌 Entrada: ${params.tip}`,
        `📊 Placar: ${params.score}`,
        metricLine,
        "",
        "🔒 Resultado completo e próximas entradas no VIP.",
      ].filter(Boolean).join("\n"),
    });

    await this.whatsappWebService.sendText(
      [
        isGreen ? "✅🔥 *GREEN ODDIX VIP*" : "❌⚠️ *RED ODDIX VIP*",
        "",
        `⚽ *${params.homeTeam} x ${params.awayTeam}*`,
        `📌 Entrada: *${params.tip}*`,
        `📊 Placar: *${params.score}*`,
        metricLine,
        params.reason ? `🧠 ${params.reason}` : "",
      ].filter(Boolean).join("\n"),
      "vip",
    );
  }

  async syncResults(source: "auto" | "manual" = "auto") {
    this.logger.log(`🔎 IA Oddix verificando GREEN/RED... origem=${source}`);

    const now = new Date();
    const minDate = new Date(now.getTime() - 1000 * 60 * 60 * 72);
    const openBets = await this.prisma.bet.findMany({
      where: {
        status: "open",
        OR: [{ gameDate: { gte: minDate } }, { createdAt: { gte: minDate } }],
      },
      orderBy: { createdAt: "desc" },
    });

    const apiKey = this.config.get<string>("API_FOOTBALL_KEY") || process.env.API_FOOTBALL_KEY || "";
    let updatedWon = 0;
    let updatedLost = 0;
    let stillOpen = 0;
    let fixtureFoundByCache = 0;
    let fixtureFoundByApi = 0;
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

        let fixture: any = null;
        let foundBy = "none";

        if (bet.fixtureId && apiKey) {
          fixture = await this.fetchFixtureById(apiKey, Number(bet.fixtureId));
          if (fixture) {
            foundBy = "api_fixtureId_fresh";
            fixtureFoundByApi++;
          }
        }

        if (!fixture && bet.fixtureId) {
          fixture = await this.getCachedFixtureById(bet.fixtureId);
          if (fixture) {
            foundBy = "cache_fixtureId";
            fixtureFoundByCache++;
          }
        }

        if (!fixture) {
          stillOpen++;
          details.push({ ...baseDetail, result: "open", reason: "Fixture não encontrado na API nem no cache" });
          continue;
        }

        const statusShort = fixture.fixture?.status?.short || "";
        const statusLong = fixture.fixture?.status?.long || "";
        const finished =
          this.isFinished(statusShort, statusLong) ||
          this.inferFinishedByTime(fixture, bet);
        const { homeGoals, awayGoals, totalGoals } = this.getGoals(fixture);
        const stats = await this.getFixtureStats(bet.fixtureId || fixture.fixture?.id);
        const resolved = this.resolveResult({
          tip: bet.tip,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          homeGoals,
          awayGoals,
          totalGoals,
          stats,
          finished,
        });

        if (resolved.result === "open") {
          stillOpen++;

          if (!finished && source === "auto" && this.shouldSendLiveUpdate(fixture, bet)) {
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
            reason: resolved.reason,
            foundBy,
            apiStatusShort: statusShort,
            apiStatusLong: statusLong,
            score: `${homeGoals}x${awayGoals}`,
            stats,
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
          } as any,
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
          totalGoals,
          stats,
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
      ignoredOldBets: "Apostas abertas com mais de 72h foram ignoradas",
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
