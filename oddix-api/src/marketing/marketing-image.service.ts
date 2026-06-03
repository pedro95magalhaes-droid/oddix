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
      `luxury football betting banner, horizontal 1062x515, black and gold sportsbook design, two generic players far left and far right, clean dark center, elegant gold glow, premium cinematic stadium, no text, no logos, no numbers`,
      `premium football betting background, horizontal 1062x515, dark navy stadium, blue rim light, subtle gold accents, two generic players on edges, clean betting panel center, sophisticated sportsbook promo, no text, no logos`,
      `cinematic elite betting banner, horizontal 1062x515, black graphite background, soft red and gold lighting, players on far sides, center empty for odds overlay, luxury sports marketing style, no text, no badges`,
      `minimal luxury football promo background, horizontal 1062x515, dark stadium, black marble texture, gold smoke, two shadow football players on edges, clean center, premium betting advertisement, no text, no logo`,
    ];

    const prompt =
      customPrompt || prompts[((params.variation || 1) - 1) % prompts.length];

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
      `vertical premium football accumulator betting background, 1080x1350, black and gold luxury sportsbook style, clean dark rows area, elegant glow, no text, no logos`,
      `vertical VIP betting multiple background, dark navy stadium, gold accents, premium panels area, subtle smoke, professional sportsbook design, no text, no numbers`,
      `vertical football tipster premium background, black graphite, orange gold glow, empty rows for bet slip, luxury sport marketing, no logos, no text`,
      `vertical elegant betting coupon background, dark stadium, clean center, gold lines, sophisticated VIP accumulator style, no text, no badges`,
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
