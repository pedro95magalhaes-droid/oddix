import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type OddixAudioCategory =
  | 'PRE_GAME'
  | 'LIVE_UPDATE'
  | 'PRESSURE'
  | 'ALMOST_GREEN'
  | 'GREEN'
  | 'RED'
  | 'BANKROLL'
  | 'MOTIVATION'
  | 'VIP_ONLY'
  | 'NIGHT_SESSION';

export type OddixAudioPersonality =
  | 'ANALISTA'
  | 'PARCEIRO'
  | 'CALMO'
  | 'ANIMADO'
  | 'CONFIANTE';

export type OddixAudioInput = {
  category: OddixAudioCategory;
  homeTeam?: string;
  awayTeam?: string;
  market?: string;
  odd?: string | number;
  minute?: string | number;
};

export type OddixAudioTemplate = {
  key: string;
  category: OddixAudioCategory;
  personality: OddixAudioPersonality;
  text: string;
};

type AudioHistoryRow = {
  audioKey: string;
  category: string;
  createdAt: string;
};

@Injectable()
export class OddixAudioEngineService {
  async pick(input: OddixAudioInput): Promise<OddixAudioTemplate> {
    const all = this.buildTemplates().filter((item) => item.category === input.category);
    const recent = this.recentKeys();

    let available = all.filter((item) => !recent.includes(item.key));
    if (!available.length) available = all;

    const selected = available[Math.floor(Math.random() * available.length)] || all[0];
    this.saveHistory(selected.key, selected.category);

    return {
      ...selected,
      text: this.replaceVars(selected.text, input),
    };
  }

  private historyFile() {
    const dir = path.join(process.cwd(), 'tmp', 'oddix-voice');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'audio-history.json');
  }

  private readHistory(): AudioHistoryRow[] {
    try {
      const file = this.historyFile();
      if (!fs.existsSync(file)) return [];
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private recentKeys() {
    const since = Date.now() - 48 * 60 * 60 * 1000;
    return this.readHistory()
      .filter((row) => new Date(row.createdAt).getTime() >= since)
      .map((row) => row.audioKey);
  }

  private saveHistory(audioKey: string, category: string) {
    const since = Date.now() - 72 * 60 * 60 * 1000;
    const history = this.readHistory()
      .filter((row) => new Date(row.createdAt).getTime() >= since)
      .slice(-500);

    history.push({ audioKey, category, createdAt: new Date().toISOString() });
    fs.writeFileSync(this.historyFile(), JSON.stringify(history, null, 2));
  }

  private replaceVars(text: string, input: OddixAudioInput) {
    return text
      .replace(/\{HOME\}/g, input.homeTeam || 'o time da casa')
      .replace(/\{AWAY\}/g, input.awayTeam || 'o visitante')
      .replace(/\{MARKET\}/g, input.market || 'essa entrada')
      .replace(/\{ODD\}/g, String(input.odd || ''))
      .replace(/\{MINUTE\}/g, String(input.minute || ''));
  }

  private buildTemplates(): OddixAudioTemplate[] {
    const categories: OddixAudioCategory[] = [
      'PRE_GAME',
      'LIVE_UPDATE',
      'PRESSURE',
      'ALMOST_GREEN',
      'GREEN',
      'RED',
      'BANKROLL',
      'MOTIVATION',
      'VIP_ONLY',
      'NIGHT_SESSION',
    ];

    const personalities: OddixAudioPersonality[] = [
      'ANALISTA',
      'PARCEIRO',
      'CALMO',
      'ANIMADO',
      'CONFIANTE',
    ];

    const templates: OddixAudioTemplate[] = [];
    for (const category of categories) {
      for (const personality of personalities) {
        for (let variation = 1; variation <= 5; variation++) {
          templates.push({
            key: `${category}_${personality}_${variation}`,
            category,
            personality,
            text: this.templateText(category, personality, variation),
          });
        }
      }
    }

    return templates;
  }

  private templateText(category: OddixAudioCategory, personality: OddixAudioPersonality, variation: number) {
    const intro = this.intro(personality);

    const map: Record<OddixAudioCategory, string[]> = {
      PRE_GAME: [
        `${intro} estou olhando {HOME} contra {AWAY} e essa linha de {MARKET} chamou atenção. Ainda é pré-jogo, então seguimos com gestão e calma.`,
        `${intro} a IA encontrou uma oportunidade interessante em {HOME} e {AWAY}. Nada de emoção, entrada com responsabilidade.`,
        `${intro} passando a leitura antes da bola rolar. O mercado de {MARKET} ficou bem interessante para esse jogo.`,
        `${intro} essa entrada foi filtrada pelo modelo e entrou no radar. Vamos trabalhar com gestão e sem all-in.`,
        `${intro} pré-jogo validado. {HOME} contra {AWAY} tem uma leitura que faz sentido para {MARKET}.`,
      ],
      LIVE_UPDATE: [
        `${intro} atualização rápida. O jogo entre {HOME} e {AWAY} segue dentro do cenário esperado para {MARKET}.`,
        `${intro} o mercado continua vivo. Ainda não tem nada ganho, mas a leitura segue positiva.`,
        `${intro} passando para avisar que o jogo continua entregando sinais interessantes.`,
        `${intro} seguimos monitorando. O comportamento da partida ainda favorece nossa entrada.`,
        `${intro} cenário mantido até aqui. Vamos acompanhar com calma até o final.`,
      ],
      PRESSURE: [
        `${intro} agora o jogo começou a mostrar pressão. Esse é o tipo de comportamento que a IA esperava para {MARKET}.`,
        `${intro} aumentou o volume da partida. Seguimos atentos porque o mercado ficou mais interessante.`,
        `${intro} a partida começou a acelerar e isso ajuda bastante a nossa leitura.`,
        `${intro} o jogo está ganhando ritmo. Ainda sem euforia, mas o cenário é bom.`,
        `${intro} pressão aparecendo em campo. Vamos seguir acompanhando com disciplina.`,
      ],
      ALMOST_GREEN: [
        `${intro} agora estamos bem perto da confirmação. Muita calma nessa hora, nada de comemorar antes.`,
        `${intro} família, a entrada está chegando muito perto. Seguimos até confirmar.`,
        `${intro} o mercado está quase batendo. Respira, acompanha e mantém a gestão.`,
        `${intro} estamos entrando na zona de confirmação. Ainda não acabou, mas ficou muito interessante.`,
        `${intro} falta pouco. O jogo entregou praticamente o cenário que a IA projetou.`,
      ],
      GREEN: [
        `${intro} green confirmado. Mais uma leitura validada pela IA Oddix. Parabéns para quem seguiu a gestão.`,
        `${intro} mercado confirmado. Green para a comunidade VIP. Seguimos com responsabilidade.`,
        `${intro} deu green. Entrada concluída com sucesso e gestão respeitada.`,
        `${intro} leitura validada. Quem entrou com calma fez o trabalho certo.`,
        `${intro} green na conta. Agora é registrar e seguir para a próxima oportunidade.`,
      ],
      RED: [
        `${intro} red controlado. Nem toda leitura termina em green, mas gestão é o que mantém o projeto de pé.`,
        `${intro} hoje o mercado não respondeu como esperado. Seguimos com disciplina.`,
        `${intro} entrada encerrada em red. Nada de desespero, o foco é longo prazo.`,
        `${intro} faz parte do jogo. Gestão protegida e próxima oportunidade será filtrada.`,
        `${intro} não veio dessa vez. Seguimos analisando e mantendo responsabilidade.`,
      ],
      BANKROLL: [
        `${intro} lembrete rápido. Sem all-in, sem dobrar mão e sem emoção. Gestão vem primeiro.`,
        `${intro} banca protegida é o que mantém o jogador vivo no longo prazo.`,
        `${intro} entrada boa não significa aposta pesada. Trabalhem sempre com unidade.`,
        `${intro} disciplina paga mais que pressa. Gestão sempre em primeiro lugar.`,
        `${intro} odd bonita não pode virar descontrole. Segue o plano.`,
      ],
      MOTIVATION: [
        `${intro} foco total. O Oddix continua filtrando oportunidades com valor.`,
        `${intro} paciência é parte do processo. Melhor perder entrada do que entrar sem valor.`,
        `${intro} a noite ainda tem mercado. Vamos seguir analisando com calma.`,
        `${intro} consistência vem de seleção, gestão e disciplina.`,
        `${intro} seguimos trabalhando para encontrar só o que faz sentido.`,
      ],
      VIP_ONLY: [
        `${intro} essa leitura completa é exclusiva do VIP. Aqui a gente entrega entrada, gestão e acompanhamento.`,
        `${intro} o diferencial do VIP é receber a leitura antes, com card e acompanhamento.`,
        `${intro} comunidade VIP recebe o cenário completo, não só o palpite seco.`,
        `${intro} aqui no VIP o foco é qualidade, não quantidade.`,
        `${intro} análise completa liberada apenas para quem está no VIP.`,
      ],
      NIGHT_SESSION: [
        `${intro} noite de jogos ativa e a IA continua filtrando os melhores mercados.`,
        `${intro} seguimos no radar dos jogos da noite. Se aparecer valor, o VIP recebe primeiro.`,
        `${intro} a rodada ainda está viva. Vamos continuar acompanhando as linhas.`,
        `${intro} noite boa para análise, mas só entra o que passar no filtro.`,
        `${intro} seguimos atentos. O Oddix continua monitorando as oportunidades.`,
      ],
    };

    return map[category][variation - 1];
  }

  private intro(personality: OddixAudioPersonality) {
    const map: Record<OddixAudioPersonality, string[]> = {
      ANALISTA: ['Pessoal, atualização do modelo.', 'Análise rápida aqui.', 'Leitura técnica agora.'],
      PARCEIRO: ['Fala família.', 'Rapaziada, passando rapidinho.', 'Meu povo, olha só.'],
      CALMO: ['Sem euforia por enquanto.', 'Com calma e gestão.', 'Passando com tranquilidade.'],
      ANIMADO: ['Olha aí, rapaziada.', 'Agora ficou interessante.', 'Bora acompanhar isso aqui.'],
      CONFIANTE: ['Gostei do que estou vendo.', 'A leitura está bem alinhada.', 'O cenário está positivo.'],
    };

    const options = map[personality];
    return options[Math.floor(Math.random() * options.length)];
  }
}
