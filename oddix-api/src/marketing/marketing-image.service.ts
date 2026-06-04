import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";

@Injectable()
export class MarketingImageService {
  private readonly logger = new Logger(MarketingImageService.name);

  private outputDir() {
    return path.join(process.cwd(), "generated", "marketing-bg");
  }

  private ensureDir() {
    const dir = this.outputDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private enabled() {
    return String(process.env.ODDIX_MARKETING_AI_ENABLED || "false").toLowerCase() === "true";
  }

  async generateSimpleBackground(params: {
    homeTeam?: string;
    awayTeam?: string;
    league?: string;
    variation?: number;
    prompt?: string;
    visualPrompt?: string;
  }): Promise<string | null> {
    if (!this.enabled()) return null;

    const customPrompt = params.visualPrompt || params.prompt;
    const prompts = [
      "ultra premium sports betting poster, horizontal 1016x515, luxury bookmaker advertisement, millionaire tipster thumbnail style, two huge generic football players on left and right, dark empty center for betting slip overlay, orange gold stadium lights, smoke, sparks, no text, no logos, no numbers",
      "aggressive football VIP betting banner, horizontal 1016x515, realistic generic players occupying both sides, premium sportsbook commercial, black gold orange lighting, center empty, no readable text, no watermark",
      "elite football tipster poster background, horizontal 1016x515, cinematic night stadium, player left celebrating, player right shouting, luxury gold glow, dark center clean space, no text no logos",
      "premium bookmaker campaign background, horizontal 1016x515, black marble and gold smoke, two football players, dramatic stadium floodlights, center empty for overlay, no badges no words",
    ];

    const prompt = customPrompt || [
      prompts[((params.variation || 1) - 1) % prompts.length],
      params.homeTeam && params.awayTeam ? `${params.homeTeam} versus ${params.awayTeam}` : "",
      params.league || "",
    ].filter(Boolean).join(", ");

    return this.generateWithPollinations(prompt, "simple", 1016, 515);
  }

  async generateMultipleBackground(params?: {
    variation?: number;
    prompt?: string;
    visualPrompt?: string;
  }): Promise<string | null> {
    if (!this.enabled()) return null;

    const customPrompt = params?.visualPrompt || params?.prompt;
    const prompts = [
      "vertical premium football accumulator betting background, 1080x1350, luxury sportsbook style, dramatic stadium, smoke, sparks, empty rows area for betting slip overlay, no text, no logos",
      "vertical VIP betting multiple background, 1080x1350, millionaire tipster style, dark navy stadium, orange gold accents, premium panels area, no text, no numbers",
      "vertical football tipster premium background, 1080x1350, black graphite, orange gold glow, empty center rows for bet slip, luxury sportsbook marketing, no logos, no text",
      "vertical aggressive betting coupon background, 1080x1350, stadium lights, gold lines, cinematic smoke, premium VIP accumulator style, no text, no badges",
    ];

    const prompt = customPrompt || prompts[((params?.variation || 1) - 1) % prompts.length];
    return this.generateWithPollinations(prompt, "multiple", 1080, 1350);
  }

  private async generateWithPollinations(prompt: string, prefix: string, width: number, height: number): Promise<string | null> {
    try {
      this.ensureDir();

      const safePrompt = [
        prompt,
        "ultra hd",
        "professional advertising",
        "clean composition",
        "high contrast",
        "no readable text",
        "no watermark",
        "no brand logos",
        "no distorted letters",
      ].join(", ");

      const encodedPrompt = encodeURIComponent(safePrompt.trim());
      const url =
        `https://image.pollinations.ai/prompt/${encodedPrompt}` +
        `?width=${width}` +
        `&height=${height}` +
        `&model=${encodeURIComponent(process.env.POLLINATIONS_MODEL || "flux")}` +
        `&nologo=true` +
        `&enhance=true` +
        `&private=true` +
        `&seed=${Date.now()}`;

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        headers: {
          Accept: "image/png,image/jpeg,image/*",
          "User-Agent": "OddixBot/2.0",
        },
      });

      const contentType = String(response.headers["content-type"] || "");
      if (!contentType.includes("image")) {
        this.logger.warn("Pollinations não retornou imagem.");
        return null;
      }

      const filePath = path.join(this.outputDir(), `${prefix}-${Date.now()}.png`);
      fs.writeFileSync(filePath, Buffer.from(response.data));
      return filePath;
    } catch (error: any) {
      this.logger.warn(`Erro Pollinations: ${error?.response?.statusText || error?.message}`);
      return null;
    }
  }
}
