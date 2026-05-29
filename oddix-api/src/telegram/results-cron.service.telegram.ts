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

@Injectable()
export class ResultsCronService {
  private readonly logger = new Logger(ResultsCronService.name);
  private readonly apiFootballURL = "https://v3.football.api-sports.io";
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

  private isTodayInFortaleza(dateValue: any) {
    if (!dateValue) return false;

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;

    const todayKey = this.formatDateKeyInFortaleza(new Date());
    const fixtureKey = this.formatDateKeyInFortaleza(date);

    return todayKey === fixtureKey;
  }

  private isFixtureActuallyLive(game: any) {
    const short = String(game?.fixture?.status?.short || "").toUpperCase();
    return ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(short);
  }

  private createFreeCopyMessage() {
    return [
      "🚨 *ENTRADA AO VIVO DETECTADA*",
      "",
      "A IA encontrou uma oportunidade agora.",
      "No FREE você recebe só uma amostra.",
      "",
      "🔒 No VIP você recebe:",
      "✅ mais entradas",
      "✅ confiança e risco",
      "✅ análise completa",
      "✅ alertas primeiro",
      "",
      "👇 Aperte no botão abaixo para virar VIP.",
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
      "🔒 Estatística completa liberada só no VIP.",
    ].join("\n");
  }

  private createVipTipMessage(bet: any) {
    const market = bet.markets?.[0];

    return [
      "🔥 *ODDIX VIP | ESTATÍSTICA AO VIVO*",
      "",
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      `🏆 ${bet.league}`,
      "",
      `✅ Entrada: *${bet.tip}*`,
      `📊 Mercado: *${market?.market || "Entrada ao vivo"}*`,
      `📈 Odd alvo: *${bet.odd}*`,
      `🧠 Confiança: *${bet.confidence}%*`,
      `⚠️ Risco: *${bet.risk}*`,
      "",
      market?.reason ? `📌 Leitura: ${market.reason}` : "",
      "",
      "💵 Gestão: 0.5 a 1 unidade.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  @Cron("*/10 * * * *")
  async sendLiveTipsAutomatically() {
    try {
      this.logger.log("🔥 ODDIX cron de palpites ao vivo iniciado...");

      const liveGames = await this.footballService.getLiveFixtures();

      if (!liveGames?.length) {
        this.logger.log(
          "⚠️ Nenhum jogo ao vivo encontrado para enviar palpite.",
        );
        return;
      }

      let sentCount = 0;
      const maxTipsPerCron = Number(
        process.env.ODDIX_MAX_LIVE_TIPS_PER_CRON || 2,
      );

      for (const game of liveGames) {
        if (sentCount >= maxTipsPerCron) break;

        const fixtureId = Number(game.fixture?.id || 0);
        const fixtureDate = game.fixture?.date;
        const statusShort = String(
          game.fixture?.status?.short || "",
        ).toUpperCase();

        if (!fixtureId) {
          this.logger.warn("⚠️ Jogo sem fixtureId. Pulando...");
          continue;
        }

        if (!this.isTodayInFortaleza(fixtureDate)) {
          this.logger.log(
            `⏭️ Pulando jogo antigo/fora de hoje: fixtureId=${fixtureId} | date=${fixtureDate}`,
          );
          continue;
        }

        if (!this.isFixtureActuallyLive(game)) {
          this.logger.log(
            `⏭️ Pulando jogo que não está ao vivo: fixtureId=${fixtureId} | status=${statusShort}`,
          );
          continue;
        }

        const alreadyExists = await this.prisma.bet.findFirst({
          where: {
            fixtureId,
          },
          select: {
            id: true,
            status: true,
            homeTeam: true,
            awayTeam: true,
          },
        });

        if (alreadyExists) {
          this.logger.log(
            `⚠️ Palpite já enviado antes para fixtureId=${fixtureId} | status=${alreadyExists.status} | ${alreadyExists.homeTeam} x ${alreadyExists.awayTeam}. Pulando...`,
          );
          continue;
        }

        const bet = await this.aiService.generateBet(game);

        if (!bet?.tip) {
          this.logger.warn(
            `⚠️ IA não gerou palpite válido para fixtureId=${fixtureId}`,
          );
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
            risk: bet.risk,
            analysis: bet.analysis,
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
          risk: bet.risk,
          stake: "0.5 a 1 unidade",
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
          await this.whatsappWebService.sendImageFile({
            filePath: imagePath,
            caption: vipMessage,
            target: "vip",
          });
        } else {
          this.logger.warn(
            "⚠️ Imagem não foi gerada. Enviando VIP apenas texto.",
          );
          await this.whatsappWebService.sendText(vipMessage, "vip");
        }

        await this.sleepRandom(90_000, 180_000);
        await this.oddixHumanMessageService.sendBetweenTips("vip");

        sentCount++;

        this.logger.log(
          `✅ Palpite enviado: FREE com botão | VIP com estatística | ${bet.homeTeam} x ${bet.awayTeam} | fixtureId=${fixtureId}`,
        );
      }

      if (sentCount === 0) {
        this.logger.log(
          "⚠️ Nenhum novo palpite enviado. Jogos antigos, não ao vivo ou já enviados foram ignorados.",
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Erro no cron de palpites: ${error?.message || "erro desconhecido"}`,
      );
    }
  }

  @Cron("0 * * * *")
  async syncResultsAutomatically() {
    return this.syncResults("auto");
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

  isFinished(statusShort: string, statusLong: string) {
    const short = this.normalize(statusShort);
    const long = this.normalize(statusLong);

    return (
      ["ft", "aet", "pen"].includes(short) ||
      long.includes("match finished") ||
      long.includes("finished")
    );
  }

  getGoals(fixture: any) {
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

  async getCachedFixtureById(fixtureId: any) {
    if (!fixtureId) return null;

    const cached = await this.prisma.cachedFixture.findUnique({
      where: {
        fixtureId: String(fixtureId),
      },
    });

    return cached?.raw || null;
  }

  async fetchApiFootball(
    apiKey: string,
    path: string,
    params: Record<string, any>,
  ) {
    const url = new URL(`${this.apiFootballURL}${path}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        "x-apisports-key": apiKey,
      },
    });

    return response.json();
  }

  async fetchFixtureById(apiKey: string, fixtureId: number) {
    try {
      if (process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === "true") {
        return null;
      }

      const data = await this.fetchApiFootball(apiKey, "/fixtures", {
        id: fixtureId,
        timezone: this.timezone,
      });

      return data?.response?.[0] || null;
    } catch {
      return null;
    }
  }

  resolveResult(params: {
    tip: string;
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    totalGoals: number;
  }): BetResult {
    const tip = this.normalize(params.tip);
    const homeTeam = this.normalize(params.homeTeam);
    const awayTeam = this.normalize(params.awayTeam);

    const homeGoals = params.homeGoals;
    const awayGoals = params.awayGoals;
    const totalGoals = params.totalGoals;

    const homeWon = homeGoals > awayGoals;
    const awayWon = awayGoals > homeGoals;
    const draw = homeGoals === awayGoals;

    if (!tip) return "open";

    const over =
      tip.match(/over\s*(\d+(\.\d+)?)/) || tip.match(/mais de\s*(\d+(\.\d+)?)/);

    if (over) {
      const line = Number(over[1]);
      return totalGoals > line ? "won" : "lost";
    }

    const under =
      tip.match(/under\s*(\d+(\.\d+)?)/) ||
      tip.match(/menos de\s*(\d+(\.\d+)?)/);

    if (under) {
      const line = Number(under[1]);
      return totalGoals < line ? "won" : "lost";
    }

    if (
      tip.includes("ambas equipes marcam sim") ||
      tip.includes("ambas marcam sim") ||
      tip.includes("btts sim")
    ) {
      return homeGoals > 0 && awayGoals > 0 ? "won" : "lost";
    }

    if (
      tip.includes("ambas equipes marcam nao") ||
      tip.includes("ambas marcam nao") ||
      tip.includes("btts nao")
    ) {
      return homeGoals === 0 || awayGoals === 0 ? "won" : "lost";
    }

    if (tip.includes("ou empate")) {
      if (tip.includes(homeTeam)) return homeWon || draw ? "won" : "lost";
      if (tip.includes(awayTeam)) return awayWon || draw ? "won" : "lost";
    }

    if (tip.includes("empate anula")) {
      if (draw) return "open";
      if (tip.includes(homeTeam)) return homeWon ? "won" : "lost";
      if (tip.includes(awayTeam)) return awayWon ? "won" : "lost";
    }

    if (tip.includes("+0.25")) {
      if (tip.includes(homeTeam)) return homeWon || draw ? "won" : "lost";
      if (tip.includes(awayTeam)) return awayWon || draw ? "won" : "lost";
    }

    if (
      tip.includes(`${homeTeam} para vencer`) ||
      tip.includes(`${homeTeam} vence`)
    ) {
      return homeWon ? "won" : "lost";
    }

    if (
      tip.includes(`${awayTeam} para vencer`) ||
      tip.includes(`${awayTeam} vence`)
    ) {
      return awayWon ? "won" : "lost";
    }

    return "open";
  }

  private async sendWhatsappResult(params: {
    result: BetResult;
    homeTeam: string;
    awayTeam: string;
    tip: string;
    score: string;
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
        "",
        "🔒 Resultado completo e próximas entradas no VIP.",
      ].join("\n"),
    });

    await this.whatsappWebService.sendText(
      [
        isGreen ? "✅🔥 *GREEN ODDIX VIP*" : "❌⚠️ *RED ODDIX VIP*",
        "",
        `⚽ *${params.homeTeam} x ${params.awayTeam}*`,
        `📌 Entrada: *${params.tip}*`,
        `📊 Placar final: *${params.score}*`,
      ].join("\n"),
      "vip",
    );
  }

  async syncResults(source: "auto" | "manual" = "auto") {
    this.logger.log(`🔎 IA Oddix verificando GREEN/RED... origem=${source}`);

    const now = new Date();
    const minDate = new Date(now.getTime() - 1000 * 60 * 60 * 48);

    const openBets = await this.prisma.bet.findMany({
      where: {
        status: "open",
        OR: [
          {
            gameDate: {
              gte: minDate,
            },
          },
          {
            createdAt: {
              gte: minDate,
            },
          },
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const apiKey =
      this.config.get<string>("API_FOOTBALL_KEY") ||
      process.env.API_FOOTBALL_KEY ||
      "";

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
            foundBy = "api_fixtureId";
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
          details.push({
            ...baseDetail,
            result: "open",
            reason: "Fixture não encontrado na API nem no cache",
          });
          continue;
        }

        const statusShort = fixture.fixture?.status?.short || "";
        const statusLong = fixture.fixture?.status?.long || "";

        if (!this.isFinished(statusShort, statusLong)) {
          stillOpen++;

          await this.oddixHumanMessageService.sendLiveUpdate("vip", {
            homeTeam: bet.homeTeam,
            awayTeam: bet.awayTeam,
            tip: bet.tip,
            score: `${fixture.goals?.home ?? "-"}x${fixture.goals?.away ?? "-"}`,
          });

          details.push({
            ...baseDetail,
            fixtureId: fixture.fixture?.id || bet.fixtureId,
            result: "open",
            reason: "Jogo encontrado, mas ainda não finalizado",
            foundBy,
            apiStatusShort: statusShort,
            apiStatusLong: statusLong,
            score: `${fixture.goals?.home ?? "-"}x${fixture.goals?.away ?? "-"}`,
          });

          continue;
        }

        const { homeGoals, awayGoals, totalGoals } = this.getGoals(fixture);

        const result = this.resolveResult({
          tip: bet.tip,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          homeGoals,
          awayGoals,
          totalGoals,
        });

        if (result === "open") {
          stillOpen++;
          details.push({
            ...baseDetail,
            fixtureId: fixture.fixture?.id || bet.fixtureId,
            result: "open",
            reason: "Mercado não reconhecido",
            foundBy,
            score: `${homeGoals}x${awayGoals}`,
            totalGoals,
          });
          continue;
        }

        await this.prisma.bet.update({
          where: { id: bet.id },
          data: {
            status: result,
            fixtureId: fixture.fixture?.id
              ? Number(fixture.fixture.id)
              : bet.fixtureId,
            homeScore: homeGoals,
            awayScore: awayGoals,
            statusShort,
          },
        });

        if (result === "won") updatedWon++;
        if (result === "lost") updatedLost++;

        await this.telegram.sendResultMessage({
          result,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          tip: bet.tip,
          score: `${homeGoals}x${awayGoals}`,
          provider: foundBy,
        });

        await this.sendWhatsappResult({
          result,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          tip: bet.tip,
          score: `${homeGoals}x${awayGoals}`,
        });

        details.push({
          ...baseDetail,
          fixtureId: fixture.fixture?.id || bet.fixtureId,
          result,
          reason: result === "won" ? "GREEN validado" : "RED validado",
          foundBy,
          apiStatusShort: statusShort,
          apiStatusLong: statusLong,
          score: `${homeGoals}x${awayGoals}`,
          totalGoals,
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

    await this.telegram.sendSyncSummary({
      checked: openBets.length,
      updatedWon,
      updatedLost,
      stillOpen,
      source,
    });

    return {
      message: "Debug GREEN/RED finalizado",
      checked: openBets.length,
      updatedWon,
      updatedLost,
      stillOpen,
      fixtureFoundByCache,
      fixtureFoundByApi,
      apiFootballDisabled:
        process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === "true",
      ignoredOldBets: "Apostas abertas com mais de 48h foram ignoradas",
      details,
    };
  }

  async debugFixturesByDate(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const cached = await this.prisma.cachedFixture.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });

    return {
      date,
      cacheLength: cached.length,
      sample: cached.slice(0, 20).map((item) => item.raw),
    };
  }
}
