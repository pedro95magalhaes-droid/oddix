import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { FootballService } from "../football/football.service";
import { AiService } from "../ai/ai.service";
import { WhatsappWebService } from "../whatsapp-web/whatsapp-web.service";
import { OddixImageService } from "./oddix-image.service";
import { OddixCreativeService } from "../marketing/oddix-creative.service";
import { OddixCopyService } from "../marketing/oddix-copy.service";

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
    private readonly oddixCreativeService: OddixCreativeService,
    private readonly oddixCopyService: OddixCopyService,
  ) {}

  private enabled() {
    return (
      String(process.env.ODDIX_PREGAME_ENABLED || "true").toLowerCase() ===
      "true"
    );
  }

  private vipLink() {
    return process.env.ODDIX_VIP_LINK || "";
  }

  private maxPerRun() {
    return Number(process.env.ODDIX_PREGAME_MAX_PER_RUN || 1);
  }

  private minConfidence() {
    return Number(
      process.env.ODDIX_PREGAME_MIN_CONFIDENCE ||
        process.env.ODDIX_MIN_CONFIDENCE ||
        85,
    );
  }

  private minOdd() {
    return Number(
      process.env.ODDIX_PREGAME_MIN_ODD || process.env.ODDIX_MIN_ODD || 1.2,
    );
  }

  private maxOdd() {
    return Number(
      process.env.ODDIX_PREGAME_MAX_ODD || process.env.ODDIX_MAX_ODD || 2.0,
    );
  }

  private priorityOnly() {
    return (
      String(
        process.env.ODDIX_PREGAME_PRIORITY_ONLY || "true",
      ).toLowerCase() === "true"
    );
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

  private currentFortalezaHour() {
    const hourText = new Intl.DateTimeFormat("en-US", {
      timeZone: this.timezone,
      hour: "2-digit",
      hour12: false,
    }).format(new Date());

    const hour = Number(hourText);
    if (!Number.isFinite(hour)) return 0;
    return hour === 24 ? 0 : hour;
  }

  private isQuietHours() {
    const hour = this.currentFortalezaHour();
    const start = Number(process.env.ODDIX_QUIET_START || 0);
    const end = Number(process.env.ODDIX_QUIET_END || 9);

    if (start === end) return false;

    if (start < end) {
      return hour >= start && hour < end;
    }

    return hour >= start || hour < end;
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
      "international friendly",
      "euro",
      "copa do nordeste",
      "copa verde",
      "paulista",
      "carioca",
      "cearense",
      "baiano",
      "mineiro",
      "gaucho",
      "gaúcho",
      "pernambucano",
      "paranaense",
      "goiano",
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
      "reserves",
      "reserve",
      "peru",
      "iran",
      "ira",
      "irã",
      "japan",
      "japao",
      "japão",
      "china",
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
      "esoccer",
      "simulado",
      "simulated",
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
    const earlyMin = Number(process.env.ODDIX_PREGAME_EARLY_MIN || 120);
    const earlyMax = Number(process.env.ODDIX_PREGAME_EARLY_MAX || 360);
    const mainMin = Number(process.env.ODDIX_PREGAME_MAIN_MIN || 30);
    const mainMax = Number(process.env.ODDIX_PREGAME_MAIN_MAX || 180);
    const finalMin = Number(process.env.ODDIX_PREGAME_FINAL_MIN || 1);
    const finalMax = Number(process.env.ODDIX_PREGAME_FINAL_MAX || 60);
    const anyMin = Number(process.env.ODDIX_PREGAME_ANY_MIN || 1);
    const anyMax = Number(process.env.ODDIX_PREGAME_ANY_MAX || 1440);
    const allowAnyWindow =
      String(process.env.ODDIX_PREGAME_ALLOW_ANY_WINDOW || "true").toLowerCase() ===
      "true";

    if (!Number.isFinite(minutes) || minutes <= 0) return null;

    if (minutes >= finalMin && minutes <= finalMax) return "final";
    if (minutes >= mainMin && minutes <= mainMax) return "main";
    if (minutes >= earlyMin && minutes <= earlyMax) return "early";

    // Fallback para não deixar o cron zerado quando os jogos ficam fora das
    // três janelas exatas. Mantém o controle por ENV e evita o problema:
    // fixtures > pregame > elegíveis=0 por causa de janela apertada.
    if (allowAnyWindow && minutes >= anyMin && minutes <= anyMax) {
      return minutes <= mainMax ? "main" : "early";
    }

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

  private explainCandidateBlock(game: any) {
    const minutes = this.minutesToStart(game);
    const stage = this.stageFor(minutes);
    const leagueScore = this.leagueScore(game);
    const priorityOk = this.isPriorityGame(game);
    const league = game?.league?.name || "Liga";
    const home = game?.teams?.home?.name || "Casa";
    const away = game?.teams?.away?.name || "Fora";

    if (!stage) {
      return {
        ok: false,
        reason: `fora da janela: ${minutes}min`,
        minutes,
        stage,
        leagueScore,
        priorityOk,
        label: `${home} x ${away} (${league})`,
      };
    }

    if (!priorityOk) {
      return {
        ok: false,
        reason:
          leagueScore <= -100
            ? `liga bloqueada/filtro: score=${leagueScore}`
            : `priorityOnly ativo: score=${leagueScore}`,
        minutes,
        stage,
        leagueScore,
        priorityOk,
        label: `${home} x ${away} (${league})`,
      };
    }

    return {
      ok: true,
      reason: "elegível",
      minutes,
      stage,
      leagueScore,
      priorityOk,
      label: `${home} x ${away} (${league})`,
    };
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
    if (confidence < this.minConfidence())
      return { ok: false, reason: `confiança baixa ${confidence}` };

    const normalizedTip = this.normalize(tip);

    const blockedMarkets = [
      "placar correto",
      "cartao vermelho",
      "vermelho",
      "expulsao",
      "bet builder agressivo",
      "resultado exato",
      "primeiro gol",
      "proximo gol",
      "próximo gol",
      "next goal",
      "first goal",
      "over 10.5 escanteios",
      "over 11.5 escanteios",
      "over 12.5 escanteios",
      "mais de 10.5 escanteios",
      "mais de 11.5 escanteios",
      "mais de 12.5 escanteios",
      "over 8.5 chutes no gol",
      "over 9.5 chutes no gol",
      "mais de 8.5 chutes no gol",
      "mais de 9.5 chutes no gol",
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

  private async existingOpenBetForFixture(fixtureId: number) {
    return this.prisma.bet.findFirst({
      where: {
        fixtureId,
        status: "open",
      } as any,
      select: {
        id: true,
        tip: true,
        confidence: true,
        odd: true,
      },
      orderBy: {
        confidence: "desc",
      } as any,
    });
  }


  private normalizeConfidence(value: any, fallback = 0) {
    const parsed = Number(String(value ?? fallback).replace("%", "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private getPropPhoto(prop: any) {
    return (
      prop?.playerPhoto ||
      prop?.photo ||
      prop?.foto ||
      prop?.image_path ||
      prop?.caminho_imagem ||
      null
    );
  }

  private getPropName(prop: any) {
    return prop?.playerName || prop?.player || prop?.name || prop?.nome || "";
  }

  private getPropConfidence(prop: any) {
    return this.normalizeConfidence(prop?.confidence ?? prop?.confiança ?? prop?.confianca, 0);
  }

  private async getBestPlayerPropForFixture(fixtureId: string | number) {
    try {
      const service: any = this.footballService as any;
      if (typeof service.getPlayerProps !== "function") return null;

      const response = await service.getPlayerProps(String(fixtureId));
      const rows = Array.isArray(response?.playerProps) ? response.playerProps : [];

      return rows
        .filter((prop: any) => this.getPropName(prop))
        .filter((prop: any) => this.getPropPhoto(prop))
        .sort((a: any, b: any) => this.getPropConfidence(b) - this.getPropConfidence(a))[0] || null;
    } catch (error: any) {
      this.logger.warn(`Player Props pré-jogo indisponível para fixtureId=${fixtureId}: ${error?.message || error}`);
      return null;
    }
  }

  private buildPlayerPropVipCaption(game: any, bet: any, prop: any, stage: PregameStage) {
    const kickoff = this.formatKickoff(game?.fixture?.date);
    const confidence = this.getPropConfidence(prop) || Number(bet?.confidence || 0) || 80;

    return [
      "🧠 *ODDIX INTELLIGENCE | PLAYER PROP VIP*",
      "",
      `⚽ *${bet.homeTeam} x ${bet.awayTeam}*`,
      bet.league ? `🏆 ${bet.league}` : "",
      kickoff ? `⏰ ${kickoff}` : "",
      "",
      `👤 Jogador: *${this.getPropName(prop)}*`,
      prop?.teamName || prop?.playerTeam ? `🏟️ Time: *${prop.teamName || prop.playerTeam}*` : "",
      `🎯 Mercado: *${prop?.marketName || prop?.market || "Player Props"}*`,
      `✅ Entrada: *${prop?.tip || prop?.selection || bet.tip}*`,
      `📈 Odd: *${prop?.odd || bet.odd || "-"}*`,
      `🧠 Confiança: *${confidence}%*`,
      `⚠️ Risco: *${prop?.risk || bet.risk || "Médio"}*`,
      "",
      "📌 Seleção validada com escalação real. Sem jogador fake, sem imagem genérica.",
      "💵 Gestão: 0.5 a 1 unidade. Sem all-in.",
    ].filter(Boolean).join("\n");
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
    ]
      .filter(Boolean)
      .join("\n");
  }

  private createVipMessage(game: any, bet: any, stage: PregameStage) {
    const kickoff = this.formatKickoff(game?.fixture?.date);
    const label =
      stage === "early"
        ? "PRÉVIA"
        : stage === "main"
          ? "PRÉ-JOGO"
          : "ENTRADA FINAL";

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
    ]
      .filter(Boolean)
      .join("\n");
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
        if (b.leagueScore !== a.leagueScore)
          return b.leagueScore - a.leagueScore;
        return a.minutes - b.minutes;
      }) as Candidate[];
  }

  @Cron("*/15 * * * *", { timeZone: "America/Fortaleza" })
  async sendPregameTipsAutomatically() {
    if (!this.enabled()) return;

    try {
      if (this.isQuietHours()) {
        this.logger.log(
          `🌙 Horário silencioso ativo (${process.env.ODDIX_QUIET_START || 0}:00 às ${process.env.ODDIX_QUIET_END || 9}:00). PRÉ-JOGO bloqueado.`,
        );
        return;
      }

      const date = this.todayKey();
      const fixtures = await this.footballService.getFixtures(date);
      const allPregame = (fixtures || []).filter((game: any) => this.isPregame(game));
      const candidatesBeforeLimit = this.buildCandidates(fixtures);
      const candidates = candidatesBeforeLimit.slice(
        0,
        this.maxPerRun(),
      );

      this.logger.log(
        `📅 Pré-jogo scan ${date}: fixtures=${fixtures?.length || 0} | pregame=${allPregame.length} | elegíveis=${candidatesBeforeLimit.length} | maxPerRun=${this.maxPerRun()} | priorityOnly=${this.priorityOnly()} | anyWindow=${process.env.ODDIX_PREGAME_ALLOW_ANY_WINDOW || "true"}`,
      );

      if (!candidates.length) {
        allPregame.slice(0, 8).forEach((game: any) => {
          const debug = this.explainCandidateBlock(game);
          this.logger.log(
            `🔎 Pré-jogo debug: ${debug.label} | minutos=${debug.minutes} | stage=${debug.stage || "none"} | leagueScore=${debug.leagueScore} | priorityOk=${debug.priorityOk} | motivo=${debug.reason}`,
          );
        });

        this.logger.log(
          "⏭️ Pré-jogo: nenhum jogo elegível. Agora o log acima mostra se foi janela, PRIORITY_ONLY ou filtro de liga.",
        );
        return;
      }

      for (const item of candidates) {
        const game = item.game;
        const stage = item.stage as PregameStage;
        const fixtureId = Number(game?.fixture?.id || 0);

        if (!fixtureId) continue;

        const existingOpenBet = await this.existingOpenBetForFixture(fixtureId);
        if (existingOpenBet) {
          this.logger.log(
            `⏭️ Pré-jogo bloqueado para evitar duplicado: fixtureId=${fixtureId} | betId=${existingOpenBet.id} | tip=${existingOpenBet.tip}`,
          );
          continue;
        }

        if (await this.alreadySent(fixtureId, stage)) {
          this.logger.log(
            `⏭️ Pré-jogo já enviado para este estágio: fixtureId=${fixtureId} | stage=${stage}`,
          );
          continue;
        }

        if (await this.alreadySentAnyPregame(fixtureId)) {
          this.logger.log(
            `⏭️ Pré-jogo já enviado anteriormente: fixtureId=${fixtureId}`,
          );
          continue;
        }

        const rawBet = await this.aiService.generateBet(
          this.pregamePayload(game),
        );
        const bet = {
          ...rawBet,
          tip: this.cleanTip(rawBet?.tip),
          homeTeam: rawBet?.homeTeam || game?.teams?.home?.name,
          awayTeam: rawBet?.awayTeam || game?.teams?.away?.name,
          league: rawBet?.league || game?.league?.name,
        };

        const quality = this.qualityAllowed(bet);
        if (!quality.ok) {
          this.logger.log(
            `⏭️ Pré-jogo reprovado ${bet.homeTeam} x ${bet.awayTeam}: ${quality.reason}`,
          );
          continue;
        }

        const premiumConfidence = Number(bet?.confidence || 0);
        const premiumOdd = Number(bet?.odd || 0);
        if (premiumConfidence < 80 || premiumOdd > 2.0) {
          this.logger.log(
            `⏭️ Quality Gate Premium pré-jogo: ${bet.homeTeam} x ${bet.awayTeam} | Conf=${premiumConfidence} | Odd=${premiumOdd}`,
          );
          continue;
        }

        const creative = this.oddixCreativeService.generate({
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          league: bet.league,
          tip: bet.tip,
          market: bet.markets?.[0]?.market || "Pré-jogo",
          odd: bet.odd,
          confidence: bet.confidence,
          risk: bet.risk || "Médio",
          stage,
        });

        const playerProp = await this.getBestPlayerPropForFixture(fixtureId);

        const analysisTag = [
          `ODDIX_PREGAME_${stage.toUpperCase()}`,
          `EDGE_IA_${creative.edge}`,
          creative.theme,
          bet.analysis || "Pré-jogo validado pela IA Oddix.",
        ].join(" | ");

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
            gameDate: game.fixture?.date
              ? new Date(game.fixture.date)
              : new Date(),
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
          text: this.oddixCopyService.freeTeaser({
            homeTeam: bet.homeTeam,
            awayTeam: bet.awayTeam,
            league: bet.league,
            tip: bet.tip,
            odd: bet.odd,
            risk: bet.risk || "Médio",
            stage,
            creative,
            vipLink: this.vipLink(),
          }),
          buttonText: "QUERO SER VIP",
          url: this.vipLink(),
        });

        const kickoff = this.formatKickoff(game?.fixture?.date);

        await this.whatsappWebService.sendText(
          [
            this.oddixCopyService.vipBefore({
              homeTeam: bet.homeTeam,
              awayTeam: bet.awayTeam,
              league: bet.league,
              tip: bet.tip,
              odd: bet.odd,
              risk: bet.risk || "Médio",
              stage,
              creative,
              vipLink: this.vipLink(),
            }),
            kickoff ? `⏰ Horário: ${kickoff}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          "vip",
        );

        const imagePath = playerProp
          ? await this.oddixImageService.createVipPlayerPropCard({
              homeTeam: bet.homeTeam,
              awayTeam: bet.awayTeam,
              league: bet.league,
              playerName: this.getPropName(playerProp),
              playerTeam: playerProp.teamName || playerProp.playerTeam || "",
              playerRole: playerProp.playerRole || playerProp.role || "Atacante",
              playerPhoto: this.getPropPhoto(playerProp),
              market: playerProp.marketName || playerProp.market || "Player Props",
              tip: playerProp.tip || playerProp.selection || bet.tip,
              odd: playerProp.odd || bet.odd,
              confidence: this.getPropConfidence(playerProp) || bet.confidence,
              risk: playerProp.risk || bet.risk || "Médio",
              teamLogo: playerProp.teamLogo || (playerProp.side === "away" ? game.teams?.away?.logo : game.teams?.home?.logo),
              status: "PRÉ-JOGO",
              source: "flashscore-lineups",
            })
          : await this.oddixImageService.createVipCard({
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
              headline: creative.headline,
              subheadline: creative.subheadline,
              vipBadge: creative.vipBadge,
              edge: creative.edge,
              confidenceLabel: creative.confidenceLabel,
              valueLabel: creative.valueLabel,
              theme: creative.theme,
              visualPrompt: creative.visualPrompt,
            });

        const vipCaption = playerProp
          ? this.buildPlayerPropVipCaption(game, bet, playerProp, stage)
          : [
              this.oddixCopyService.vipCaption({
                homeTeam: bet.homeTeam,
                awayTeam: bet.awayTeam,
                league: bet.league,
                tip: bet.tip,
                odd: bet.odd,
                risk: bet.risk || "Médio",
                stage,
                creative,
                vipLink: this.vipLink(),
              }),
              "",
              "📌 *Leitura Oddix:*",
              this.shortAnalysis(bet.analysis),
            ].join("\n");

        if (imagePath) {
          await this.whatsappWebService.sendImageFile({
            filePath: imagePath,
            caption: vipCaption,
            target: "vip",
          });
        } else {
          await this.whatsappWebService.sendText(vipCaption, "vip");
        }

        this.logger.log(
          `✅ Pré-jogo enviado: ${bet.homeTeam} x ${bet.awayTeam} | ${stage} | ${creative.theme} | ${creative.edge}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Erro no cron pré-jogo: ${error?.message || "erro desconhecido"}`,
      );
    }
  }
}
