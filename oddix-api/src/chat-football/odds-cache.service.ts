import { Injectable, Logger } from '@nestjs/common';

export type OddixCacheEntry<T = any> = {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
};

@Injectable()
export class OddsCacheService {
  private readonly logger = new Logger(OddsCacheService.name);
  private readonly store = new Map<string, OddixCacheEntry>();
  private readonly defaultTtlMs = Number(process.env.ODDIX_V15_CACHE_TTL_MINUTES || 15) * 60 * 1000;

  private now() {
    return Date.now();
  }

  private normalizeKey(key: string) {
    return String(key || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9:_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
  }

  set<T = any>(key: string, value: T, ttlMs = this.defaultTtlMs): T {
    const normalized = this.normalizeKey(key);
    if (!normalized) return value;

    this.store.set(normalized, {
      key: normalized,
      value,
      createdAt: this.now(),
      expiresAt: this.now() + ttlMs,
    });

    return value;
  }

  get<T = any>(key: string): T | null {
    const normalized = this.normalizeKey(key);
    if (!normalized) return null;

    const entry = this.store.get(normalized);
    if (!entry) return null;

    if (entry.expiresAt <= this.now()) {
      this.store.delete(normalized);
      return null;
    }

    return entry.value as T;
  }

  getOrSet<T = any>(key: string, valueFactory: () => T, ttlMs = this.defaultTtlMs): T {
    const cached = this.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;
    return this.set<T>(key, valueFactory(), ttlMs);
  }

  setRichContext(fixtureId: string, richContext: any) {
    if (!fixtureId || !richContext) return richContext;
    return this.set(`rich:${fixtureId}`, richContext);
  }

  getRichContext(fixtureId: string) {
    if (!fixtureId) return null;
    return this.get<any>(`rich:${fixtureId}`);
  }

  setFixture(home: string, away: string, fixture: any) {
    if (!home || !away || !fixture) return fixture;
    this.set(`fixture:${home}:${away}`, fixture);
    this.set(`fixture:${away}:${home}`, fixture);
    return fixture;
  }

  getFixture(home: string, away: string) {
    if (!home || !away) return null;
    return this.get<any>(`fixture:${home}:${away}`) || this.get<any>(`fixture:${away}:${home}`);
  }

  clear() {
    const size = this.store.size;
    this.store.clear();
    this.logger.log(`[ODDIX_V15_CACHE] cache limpo (${size} entradas).`);
    return { cleared: size };
  }

  stats() {
    let active = 0;
    let expired = 0;
    const now = this.now();

    for (const entry of this.store.values()) {
      if (entry.expiresAt > now) active += 1;
      else expired += 1;
    }

    return {
      active,
      expired,
      total: this.store.size,
      ttlMinutes: Math.round(this.defaultTtlMs / 60000),
    };
  }
}
