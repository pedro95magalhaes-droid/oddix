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
    return (
      String(
        process.env.ODDIX_MARKETING_AI_ENABLED || "false",
      ).toLowerCase() === "true"
    );
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
      `ultra premium sportsbook advertisement, horizontal 1062x515, millionaire tipster thumbnail style, dramatic football stadium at night, two generic football players on sides, orange gold lighting, smoke, sparks, dark empty center for odds overlay, no text, no logos, no numbers`,
      `aggressive football betting banner, horizontal 1062x515, luxury sportsbook commercial, giant generic player left and right, black and gold, cinematic smoke, high contrast, clean center, no readable text, no watermark`,
      `elite VIP betting poster background, horizontal 1062x515, black graphite, red orange gold lighting, stadium floodlights, players on edges, center empty for market overlay, no text, no badges`,
      `premium football promo background, horizontal 1062x515, millionaire betting style, black marble and gold smoke, dramatic stadium, two shadow football players, clean center, no text, no logo`,
    ];

    const prompt =
      customPrompt ||
      [
        prompts[((params.variation || 1) - 1) % prompts.length],
        params.homeTeam && params.awayTeam ? `${params.homeTeam} versus ${params.awayTeam}` : "",
        params.league || "",
      ]
        .filter(Boolean)
        .join(", ");

    return this.generateWithPollinations(prompt, "simple", 1062, 515);
  }

  async generateMultipleBackground(params?: {
    variation?: number;
    prompt?: string;
    visualPrompt?: string;
  }): Promise<string | null> {
    if (!this.enabled()) return null;

    const customPrompt = params?.visualPrompt || params?.prompt;

    const prompts = [
      `vertical premium football accumulator betting background, 1080x1350, black and gold luxury sportsbook style, dramatic stadium, smoke, sparks, empty rows area for betting slip overlay, no text, no logos`,
      `vertical VIP betting multiple background, 1080x1350, millionaire tipster style, dark navy stadium, orange gold accents, premium panels area, no text, no numbers`,
      `vertical football tipster premium background, 1080x1350, black graphite, orange gold glow, empty center rows for bet slip, luxury sportsbook marketing, no logos, no text`,
      `vertical aggressive betting coupon background, 1080x1350, stadium lights, gold lines, cinematic smoke, premium VIP accumulator style, no text, no badges`,
    ];

    const prompt =
      customPrompt || prompts[((params?.variation || 1) - 1) % prompts.length];

    return this.generateWithPollinations(prompt, "multiple", 1080, 1350);
  }

  private async generateWithPollinations(
    prompt: string,
    prefix: string,
    width: number,
    height: number,
  ): Promise<string | null> {
    try {
      this.ensureDir();

      const safePrompt = [
        prompt,
        "ultra hd",
        "professional advertising",
        "clean composition",
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
          "User-Agent": "OddixBot/1.0",
        },
      });

      const contentType = String(response.headers["content-type"] || "");

      if (!contentType.includes("image")) {
        this.logger.warn("Pollinations não retornou imagem.");
        return null;
      }

      const filePath = path.join(
        this.outputDir(),
        `${prefix}-${Date.now()}.png`,
      );
      fs.writeFileSync(filePath, Buffer.from(response.data));

      return filePath;
    } catch (error: any) {
      this.logger.warn(
        `Erro Pollinations: ${error?.response?.statusText || error?.message}`,
      );
      return null;
    }
  }
}
