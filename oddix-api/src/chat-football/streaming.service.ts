import { Injectable } from '@nestjs/common';

export type OddixStreamChunk = {
  index: number;
  delta: string;
  done: boolean;
};

@Injectable()
export class StreamingService {
  chunkText(text: string, maxChunkLength = 42): OddixStreamChunk[] {
    const safeText = String(text || '');
    if (!safeText) return [{ index: 0, delta: '', done: true }];

    const words = safeText.split(/(\s+)/);
    const chunks: string[] = [];
    let current = '';

    for (const word of words) {
      if ((current + word).length >= maxChunkLength && current.trim()) {
        chunks.push(current);
        current = word;
      } else {
        current += word;
      }
    }

    if (current) chunks.push(current);

    return chunks.map((delta, index) => ({
      index,
      delta,
      done: index === chunks.length - 1,
    }));
  }

  buildPseudoStreamResponse(answer: string, data: Record<string, any> = {}) {
    return {
      success: true,
      mode: 'pseudo-stream',
      chunks: this.chunkText(answer),
      answer,
      data,
    };
  }
}
