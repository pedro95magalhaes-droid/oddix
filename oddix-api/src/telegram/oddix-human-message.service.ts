import { Injectable, Logger } from "@nestjs/common";
import { WhatsappWebService } from "../whatsapp-web/whatsapp-web.service";

type GroupType = "free" | "vip";

type LiveUpdatePayload = {
  homeTeam?: string;
  awayTeam?: string;
  tip?: string;
  score?: string;
};

@Injectable()
export class OddixHumanMessageService {
  private readonly logger = new Logger(OddixHumanMessageService.name);
  private readonly lastMessageAt = new Map<string, number>();

  private readonly minIntervalMs: Record<GroupType, number> = {
    free: Number(process.env.ODDIX_FREE_HUMAN_INTERVAL_MS || 30 * 60 * 1000),
    vip: Number(process.env.ODDIX_VIP_HUMAN_INTERVAL_MS || 10 * 60 * 1000),
  };

  constructor(private readonly whatsappWebService: WhatsappWebService) {}

  async sendBeforeTip(group: GroupType) {
    const key = `${group}:before-tip`;
    if (!this.canSend(key, group)) return;

    const messages =
      group === "vip"
        ? this.vipBeforeTipMessages()
        : this.freeBeforeTipMessages();

    await this.safeSend(this.random(messages), group);
  }

  async sendLiveUpdate(group: GroupType, payload?: LiveUpdatePayload) {
    const key = `${group}:live-update`;
    if (!this.canSend(key, group)) return;

    const messages =
      group === "vip"
        ? this.vipLiveUpdateMessages(payload)
        : this.freeLiveUpdateMessages(payload);

    await this.safeSend(this.random(messages), group);
  }

  async sendAfterGreen(group: GroupType) {
    const key = `${group}:green`;
    if (!this.canSend(key, group)) return;

    const messages =
      group === "vip" ? this.vipGreenMessages() : this.freeGreenMessages();

    await this.safeSend(this.random(messages), group);
  }

  async sendAfterRed(group: GroupType) {
    const key = `${group}:red`;
    if (!this.canSend(key, group)) return;

    const messages =
      group === "vip" ? this.vipRedMessages() : this.freeRedMessages();

    await this.safeSend(this.random(messages), group);
  }

  async sendBetweenTips(group: GroupType) {
    const key = `${group}:between-tips`;
    if (!this.canSend(key, group)) return;

    const messages =
      group === "vip"
        ? this.vipBetweenTipsMessages()
        : this.freeBetweenTipsMessages();

    await this.safeSend(this.random(messages), group);
  }

  private canSend(key: string, group: GroupType) {
    const now = Date.now();
    const last = this.lastMessageAt.get(key) || 0;
    const minInterval = this.minIntervalMs[group];

    if (now - last < minInterval) {
      this.logger.log(`⏭️ Mensagem humana bloqueada por intervalo: ${key}`);
      return false;
    }

    this.lastMessageAt.set(key, now);
    return true;
  }

  private random<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  private async safeSend(message: string, group: GroupType) {
    try {
      await this.whatsappWebService.sendText(message, group);
    } catch (error: any) {
      this.logger.error(
        `❌ Erro ao enviar mensagem humana ${group}: ${error?.message || "erro desconhecido"}`,
      );
    }
  }

  private vipBeforeTipMessages() {
    return [
      [
        "👀 Tropa VIP, atenção...",
        "",
        "A IA acabou de encontrar uma oportunidade interessante na rodada.",
        "Estou validando os últimos números antes de liberar a entrada.",
        "",
        "Se a odd continuar com valor, o sinal sai agora. 🚀⚽",
      ].join("\n"),
      [
        "🔥 E AÍ, TROPA VIP!",
        "",
        "Tem jogo entrando forte no radar da IA.",
        "Os dados estão batendo com o cenário que a gente gosta.",
        "",
        "Nada de entrada no impulso. Aqui é análise primeiro, clique depois. 📊",
      ].join("\n"),
      [
        "⚽ Segura aí, família VIP...",
        "",
        "A IA está cruzando estatística, momento das equipes e valor da odd.",
        "Se confirmar, vou liberar uma entrada bem interessante.",
        "",
        "Gestão sempre, sem loucura. 💎",
      ].join("\n"),
      [
        "🚨 Possível entrada vindo aí...",
        "",
        "A rodada está mexida e apareceu um mercado bem interessante.",
        "Vou soltar só se continuar dentro dos critérios da IA.",
        "",
        "Paciência que é assim que a banca cresce. 📈",
      ].join("\n"),
    ];
  }

  private vipLiveUpdateMessages(payload?: LiveUpdatePayload) {
    const game =
      payload?.homeTeam && payload?.awayTeam
        ? `\n⚽ ${payload.homeTeam} x ${payload.awayTeam}`
        : "";
    const score = payload?.score ? `\n📊 Placar agora: ${payload.score}` : "";
    const tip = payload?.tip ? `\n📌 Entrada: ${payload.tip}` : "";

    return [
      [
        "📊 Atualização da IA:",
        game,
        score,
        tip,
        "",
        "O jogo está seguindo bem próximo do cenário esperado.",
        "Ainda não tem nada ganho, mas a leitura continua viva.",
        "",
        "Seguimos acompanhando sem emoção. 👀⚽",
      ]
        .filter(Boolean)
        .join("\n"),
      [
        "🔥 Boa movimentação nesse jogo!",
        game,
        score,
        "",
        "A entrada segue fazendo sentido até aqui.",
        "Agora é deixar o mercado trabalhar.",
        "",
        "Gestão na mão e paciência. 🚀",
      ]
        .filter(Boolean)
        .join("\n"),
      [
        "👀 Tropa, atualização rápida:",
        game,
        score,
        tip,
        "",
        "Os números ao vivo continuam interessantes para nossa entrada.",
        "Nada de comemorar antes da hora, mas estamos no caminho certo.",
        "",
        "Seguimos monitorando. 📈",
      ]
        .filter(Boolean)
        .join("\n"),
    ];
  }

  private vipGreenMessages() {
    return [
      [
        "🟢 GREEEEEEEN, TROPA! 🟢",
        "",
        "Mais uma leitura correta da IA. 🚀🔥",
        "",
        "Parabéns para quem entrou com gestão.",
        "Banca protegida, cabeça fria e seguimos para a próxima oportunidade. 💰",
      ].join("\n"),
      [
        "🚀 GREEN CONFIRMADO!",
        "",
        "A leitura bateu bonito.",
        "É isso que a gente busca: valor, paciência e consistência.",
        "",
        "Seguimos, família VIP! 💎⚽",
      ].join("\n"),
      [
        "🟢 AÍ SIM, FAMÍLIA!",
        "",
        "Entrada validada e green na conta.",
        "Sem euforia, sem aumentar mão, só gestão e constância.",
        "",
        "Vamos para a próxima com inteligência. 📈",
      ].join("\n"),
    ];
  }

  private vipRedMessages() {
    return [
      [
        "🔴 RED confirmado.",
        "",
        "Faz parte do mercado, tropa.",
        "Nem toda leitura vai bater, por isso a gestão é o que protege a banca.",
        "",
        "Sem desespero. Seguimos analisando a próxima com calma. 📊",
      ].join("\n"),
      [
        "🔴 Entrada não bateu dessa vez.",
        "",
        "O importante é manter o plano.",
        "Quem trabalha com gestão continua vivo para aproveitar as próximas oportunidades.",
        "",
        "Seguimos firmes. ⚽",
      ].join("\n"),
      [
        "⚠️ Não veio dessa vez, família.",
        "",
        "Mercado tem variância e por isso a gente nunca entra pesado.",
        "Gestão é o que mantém a banca de pé.",
        "",
        "Cabeça fria e próxima análise. 💎",
      ].join("\n"),
    ];
  }

  private vipBetweenTipsMessages() {
    return [
      [
        "🔥 Tropa, enquanto esse jogo rola...",
        "",
        "A IA já está varrendo os próximos mercados.",
        "Mas só vai sair entrada se tiver valor real.",
        "",
        "Melhor poucos sinais bons do que vários sinais forçados. 💎",
      ].join("\n"),
      [
        "⚽ Família VIP, sem pressa.",
        "",
        "A rodada está movimentada, mas a gente não entra em qualquer jogo.",
        "Aqui é filtro pesado antes de mandar sinal.",
        "",
        "Quando aparecer valor, vocês recebem primeiro. 🚀",
      ].join("\n"),
      [
        "👀 Seguimos de olho na rodada...",
        "",
        "Não é quantidade de palpite que faz banca crescer.",
        "É entrada boa, odd com valor e gestão bem feita.",
        "",
        "Se pintar coisa boa, eu aviso. 🔥",
      ].join("\n"),
    ];
  }

  private freeBeforeTipMessages() {
    return [
      [
        "👀 Fala, tropa ODDIX!",
        "",
        "A IA encontrou uma oportunidade e vai liberar uma amostra por aqui.",
        "",
        "No VIP saem as entradas completas com análise, odd, confiança e risco. 💎",
      ].join("\n"),
      [
        "🔥 Atenção, grupo FREE!",
        "",
        "Pintou uma amostra da IA para vocês acompanharem.",
        "O sinal completo e as melhores oportunidades ficam no VIP. 🚀",
      ].join("\n"),
    ];
  }

  private freeLiveUpdateMessages(payload?: LiveUpdatePayload) {
    const game =
      payload?.homeTeam && payload?.awayTeam
        ? `\n⚽ ${payload.homeTeam} x ${payload.awayTeam}`
        : "";
    const score = payload?.score ? `\n📊 Placar agora: ${payload.score}` : "";

    return [
      [
        "📊 Atualização rápida:",
        game,
        score,
        "",
        "O jogo está movimentando bem.",
        "No VIP a galera acompanha as entradas completas em tempo real. 💎",
      ]
        .filter(Boolean)
        .join("\n"),
    ];
  }

  private freeGreenMessages() {
    return [
      [
        "🟢 GREEN NA ÁREA!",
        "",
        "Mais uma leitura boa da IA.",
        "",
        "Quer receber as entradas completas?",
        "Vem para o VIP. 💎🚀",
      ].join("\n"),
    ];
  }

  private freeRedMessages() {
    return [
      [
        "🔴 Essa não bateu.",
        "",
        "Faz parte do jogo. O segredo é gestão e consistência.",
        "",
        "No VIP seguimos com análise completa e controle de risco. 💎",
      ].join("\n"),
    ];
  }

  private freeBetweenTipsMessages() {
    return [
      [
        "🔥 A IA continua analisando a rodada.",
        "",
        "Por aqui vai sair só uma amostra.",
        "As melhores oportunidades completas ficam no VIP. 💎",
      ].join("\n"),
    ];
  }
}
