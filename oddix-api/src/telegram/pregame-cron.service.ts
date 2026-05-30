import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { FootballService } from "../football/football.service";
import { AiService } from "../ai/ai.service";
import { WhatsappWebService } from "../whatsapp-web/whatsapp-web.service";
import { OddixImageService } from "./oddix-image.service";

type PregameStage = "early" | "main" | "final";

type Candidate = {
  game: any;
  minutes: number;
  stage: PregameStage;
  leagueScore: number;
};

@Injectable()
export class PregameCronService {
  private readonly logger = new Logger(PregameCronService.name);
  private readonly timezone = "America/Fortaleza";

  constructor(
    private readonly prisma: PrismaService,
    private readonly footballService: FootballService,
    private readonly aiService: AiService,
    private readonly whatsappWebService: WhatsappWebService,
    private readonly oddixImageService: OddixImageService,
  ) {}

  private enabled() {
    return String(process.env.ODDIX_PREGAME_ENABLED || "true").toLowerCase() === "true";
  }

  private vipLink() {
    return process.env.ODDIX_VIP_LINK || "";
  }

  private maxPerRun() {
    return Number(process.env.ODDIX_PREGAME_MAX_PER_RUN || 2);
  }

  private minConfidence() {
    return Number(process.env.ODDIX_PREGAME_MIN_CONFIDENCE || process.env.ODDIX_MIN_CONFIDENCE || 72);
  }

  private minOdd() {
    return Number(process.env.ODDIX_PREGAME_MIN_ODD || process.env.ODDIX_MIN_ODD || 1.2);
  }

  private maxOdd() {
    return Number(process.env.ODDIX_PREGAME_MAX_ODD || process.env.ODDIX_MAX_ODD || 3.0);
  }

  private priorityOnly() {
    return String(process.env.ODDIX_PREGAME_PRIORITY_ONLY || "true").toLowerCase() === "true";
  }

  private formatDateKey(date: Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: this.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  private todayKey() {
    return this.formatDateKey(new Date());
  }

  private normalize(text: any) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private listFromEnv(envName: string, fallback: string[]) {
    const raw = String(process.env[envName] || "").trim();
    if (!raw) return fallback;

    return raw
      .split(",")
      .map((item) => this.normalize(item))
      .filter(Boolean);
  }

  private priorityWords() {
    return this.listFromEnv("ODDIX_PREGAME_PRIORITY_WORDS", [
      "champions",
      "uefa champions league",
      "libertadores",
      "sudamericana",
      "europa league",
      "conference league",
      "premier league",
      "la liga",
      "serie a",
      "bundesliga",
      "ligue 1",
      "brasileirao",
      "brasil serie a",
      "brazil serie a",
      "brasil serie b",
      "brazil serie b",
      "copa do brasil",
      "copa argentina",
      "argentina primera",
      "portugal",
      "eredivisie",
      "mls",
      "world cup",
      "euro",
    ]);
  }

  private blockedWords() {
    return this.listFromEnv("ODDIX_PREGAME_BLOCKED_WORDS", [
      "u23",
      "u21",
      "u20",
      "u19",
      "u18",
      "u17",
      "sub 23",
      "sub 21",
      "sub 20",
      "sub 19",
      "sub 18",
      "sub 17",
      "youth",
      "junior",
      "primavera",
      "women",
      "woman",
      "feminino",
      "feminina",
      "friendly",
      "amistoso",
      "reserves",
      "reserve",
      "macao",
      "macau",
      "syria",
      "malawi",
      "division 3",
      "division 4",
      "divisao 3",
      "divisao 4",
      "3 liga",
      "4 liga",
      "3 cfl",
      "regionalliga",
      "segunda b",
      "relegation group",
      "rebaixamento",
    ]);
  }

  private minutesToStart(game: any) {
    const rawDate = game?.fixture?.date;
    if (!rawDate) return Number.POSITIVE_INFINITY;

    const start = new Date(rawDate).getTime();
    if (Number.isNaN(start)) return Number.POSITIVE_INFINITY;

    return Math.floor((start - Date.now()) / 1000 / 60);
  }

  private stageFor(minutes: number): PregameStage | null {
    if (minutes >= 150 && minutes <= 210) return "early";
    if (minutes >= 45 && minutes <= 90) return "main";
    if (minutes >= 10 && minutes <= 35) return "final";
    return null;
  }

  private isPregame(game: any) {
    const short = String(game?.fixture?.status?.short || "").toUpperCase();
    const long = this.normalize(game?.fixture?.status?.long);
    const minutes = this.minutesToStart(game);

    const scheduled =
      ["NS", "TBD", "SCHEDULED", "TIMED", "UNK", ""].includes(short) ||
      long.includes("not started") ||
      long.includes("scheduled") ||
      long.includes("unknown");

    return scheduled && minutes > 0;
  }

  private leagueText(game: any) {
    const league = this.normalize(game?.league?.name);
    const country = this.normalize(game?.league?.country);
    const home = this.normalize(game?.teams?.home?.name);
    const away = this.normalize(game?.teams?.away?.name);
    return `${league} ${country} ${home} ${away}`;
  }

  private leagueScore(game: any) {
    const text = this.leagueText(game);
    const blocked = this.blockedWords();
    const priority = this.priorityWords();

    if (blocked.some((word) => text.includes(word))) return -100;
    if (priority.some((word) => text.includes(word))) return 100;

    return 10;
  }

  private isPriorityGame(game: any) {
    const score = this.leagueScore(game);

    if (score >= 100) return true;
    if (score <= -100) return false;

    return !this.priorityOnly();
  }

  private cleanTip(tip: any) {
    const cleaned = String(tip || "")
      .replace(/^ao vivo\s*:\s*/i, "")
      .replace(/^live\s*:\s*/i, "")
      .replace(/^pre jogo\s*:\s*/i, "")
      .replace(/^pré jogo\s*:\s*/i, "")
      .replace(/^pré-jogo\s*:\s*/i, "")
      .trim();

    return cleaned ? `Pré-jogo: ${cleaned}` : "Pré-jogo: entrada conservadora";
  }

  private qualityAllowed(bet: any) {
    const odd = Number(bet?.odd || 0);
    const confidence = Number(bet?.confidence || 0);
    const tip = String(bet?.tip || "").trim();

    if (!tip) return { ok: false, reason: "sem tip" };
    if (odd < this.minOdd()) return { ok: false, reason: `odd baixa ${odd}` };
    if (odd > this.maxOdd()) return { ok: false, reason: `odd alta ${odd}` };
    if (confidence < this.minConfidence()) return { ok: false, reason: `confiança baixa ${confidence}` };

    const normalizedTip = this.normalize(tip);

    const blockedMarkets = [
      "placar correto",
      "cartao vermelho",
      "vermelho",
      "expulsao",
      "bet builder agressivo",
      "resultado exato",
    ];

    if (blockedMarkets.some((word) => normalizedTip.includes(word))) {
      return { ok: false, reason: `mercado bloqueado: ${tip}` };
    }

    return { ok: true, reason: "ok" };
  }

  private async alreadySent(fixtureId: number, stage: PregameStage) {
    const found = await this.prisma.bet.findFirst({
      where: {
        fixtureId,
        analysis: { contains: `ODDIX_PREGAME_${stage.toUpperCase()}` },
      } as any,
      select: { id: true },
    });

    return !!found;
  }

  private async alreadySentAnyPregame(fixtureId: number) {
    const found = await this.prisma.bet.findFirst({
      where: {
        fixtureId,
        analysis: { contains: "ODDIX_PREGAME_" },
      } as any,
      select: { id: true },
    });

    return !!found;
  }

  private createFreeMessage(game: any, bet: any, stage: PregameStage) {
    const kickoff = this.formatKickoff(game?.fixture?.date);

    return [
      "🔥 *ODDIX FREE | PRÉ-JOGO*",
      "",
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      bet.league ? `🏆 ${bet.league}` : "",
      kickoff ? `⏰ ${kickoff}` : "",
      "",
      `✅ Amostra: *${this.cleanTip(bet.tip)}*`,
      `📈 Odd alvo: *${bet.odd || "-"}*`,
      "",
      "🔒 No VIP sai análise completa, card premium e entradas primeiro.",
      this.vipLink() ? "👇 Entre no VIP:" : "",
      this.vipLink(),
    ].filter(Boolean).join("\n");
  }

  private createVipMessage(game: any, bet: any, stage: PregameStage) {
    const kickoff = this.formatKickoff(game?.fixture?.date);
    const label = stage === "early" ? "PRÉVIA" : stage === "main" ? "PRÉ-JOGO" : "ENTRADA FINAL";

    return [
      `🔥 *ODDIX VIP | ${label}*`,
      "",
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      bet.league ? `🏆 ${bet.league}` : "",
      kickoff ? `⏰ ${kickoff}` : "",
      "",
      `✅ Entrada: *${this.cleanTip(bet.tip)}*`,
      `📈 Odd: *${bet.odd || "-"}*`,
      `🧠 Confiança: *${bet.confidence || "-"}%*`,
      `⚠️ Risco: *${bet.risk || "Médio"}*`,
      "",
      "📌 Leitura Oddix:",
      this.shortAnalysis(bet.analysis),
      "",
      "💵 Gestão: 0.5 a 1 unidade. Sem all-in.",
    ].filter(Boolean).join("\n");
  }

  private shortAnalysis(text: any) {
    const clean = String(text || "Entrada validada pela IA Oddix.")
      .replace(/\n{2,}/g, "\n")
      .trim();

    return clean.length > 520 ? `${clean.slice(0, 520)}...` : clean;
  }

  private formatKickoff(dateValue: any) {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("pt-BR", {
      timeZone: this.timezone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private pregamePayload(game: any) {
    return {
      ...game,
      fixture: {
        ...game.fixture,
        status: {
          ...(game.fixture?.status || {}),
          short: "NS",
          long: "Not Started",
          elapsed: null,
        },
      },
      status: { short: "NS", long: "Not Started", elapsed: null },
      homeTeam: game?.teams?.home?.name,
      awayTeam: game?.teams?.away?.name,
      league: game?.league?.name,
      leagueName: game?.league?.name,
      goals: { home: 0, away: 0 },
      score: { fulltime: { home: 0, away: 0 } },
    };
  }

  private buildCandidates(fixtures: any[]): Candidate[] {
    return (fixtures || [])
      .filter((game: any) => this.isPregame(game))
      .map((game: any) => {
        const minutes = this.minutesToStart(game);
        const stage = this.stageFor(minutes);
        return {
          game,
          minutes,
          stage,
          leagueScore: this.leagueScore(game),
        };
      })
      .filter((item: any) => item.stage)
      .filter((item: any) => this.isPriorityGame(item.game))
      .sort((a: any, b: any) => {
        if (b.leagueScore !== a.leagueScore) return b.leagueScore - a.leagueScore;
        return a.minutes - b.minutes;
      }) as Candidate[];
  }

  @Cron("*/15 * * * *", { timeZone: "America/Fortaleza" })
  async sendPregameTipsAutomatically() {
    if (!this.enabled()) return;

    try {
      const date = this.todayKey();
      const fixtures = await this.footballService.getFixtures(date);
      const candidates = this.buildCandidates(fixtures).slice(0, this.maxPerRun());

      if (!candidates.length) {
        this.logger.log("⏭️ Pré-jogo: nenhum jogo elegível na janela atual.");
        return;
      }

      for (const item of candidates) {
        const game = item.game;
        const stage = item.stage as PregameStage;
        const fixtureId = Number(game?.fixture?.id || 0);

        if (!fixtureId) continue;

        if (await this.alreadySent(fixtureId, stage)) {
          this.logger.log(`⏭️ Pré-jogo já enviado para este estágio: fixtureId=${fixtureId} | stage=${stage}`);
          continue;
        }

        if (stage !== "final" && await this.alreadySentAnyPregame(fixtureId)) {
          this.logger.log(`⏭️ Pré-jogo já enviado anteriormente: fixtureId=${fixtureId}`);
          continue;
        }

        const rawBet = await this.aiService.generateBet(this.pregamePayload(game));
        const bet = {
          ...rawBet,
          tip: this.cleanTip(rawBet?.tip),
          homeTeam: rawBet?.homeTeam || game?.teams?.home?.name,
          awayTeam: rawBet?.awayTeam || game?.teams?.away?.name,
          league: rawBet?.league || game?.league?.name,
        };

        const quality = this.qualityAllowed(bet);
        if (!quality.ok) {
          this.logger.log(`⏭️ Pré-jogo reprovado ${bet.homeTeam} x ${bet.awayTeam}: ${quality.reason}`);
          continue;
        }

        const analysisTag = `ODDIX_PREGAME_${stage.toUpperCase()} | ${bet.analysis || "Pré-jogo validado pela IA Oddix."}`;

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
            analysis: analysisTag,
            status: "open",
            gameDate: game.fixture?.date ? new Date(game.fixture.date) : new Date(),
            homeLogo: game.teams?.home?.logo || null,
            awayLogo: game.teams?.away?.logo || null,
            leagueLogo: game.league?.logo || null,
            statusShort: "NS",
            elapsed: null,
            provider: game.provider || "pregame",
            markets: bet.markets || [],
            multiples: bet.multiples || null,
          } as any,
        });

        await this.whatsappWebService.sendButtonText({
          target: "free",
          text: this.createFreeMessage(game, bet, stage),
          buttonText: "QUERO SER VIP",
          url: this.vipLink(),
        });

        const imagePath = await this.oddixImageService.createVipCard({
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          league: bet.league,
          market: bet.markets?.[0]?.market || "Pré-jogo",
          tip: bet.tip,
          odd: bet.odd,
          confidence: bet.confidence,
          risk: bet.risk || "Médio",
          stake: "0.5 a 1 unidade",
          homeLogo: game.teams?.home?.logo,
          awayLogo: game.teams?.away?.logo,
          status: "PRÉ-JOGO",
          elapsed: null,
          source: game.provider || "fixtures",
        });

        if (imagePath) {
          await this.whatsappWebService.sendImageFile({
            filePath: imagePath,
            caption: this.createVipMessage(game, bet, stage),
            target: "vip",
          });
        } else {
          await this.whatsappWebService.sendText(this.createVipMessage(game, bet, stage), "vip");
        }

        this.logger.log(`✅ Pré-jogo enviado: ${bet.homeTeam} x ${bet.awayTeam} | ${bet.tip} | stage=${stage}`);
      }
    } catch (error: any) {
      this.logger.error(`❌ Erro no cron pré-jogo: ${error?.message || "erro desconhecido"}`);
    }
  }
}
