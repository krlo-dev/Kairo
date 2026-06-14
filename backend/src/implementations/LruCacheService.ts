import { LRUCache } from 'lru-cache';
import type { CacheService } from '../interfaces/CacheService.js';

interface Options {
  max?: number;
  defaultTtlSeconds?: number;
}

// LRUCache requires V to extend {} (non-null). We wrap arbitrary values
// in an envelope so we can store `null`/primitives uniformly.
interface Envelope {
  v: unknown;
}

export class LruCacheService implements CacheService {
  private cache: LRUCache<string, Envelope>;
  private defaultTtlMs: number;

  constructor(opts: Options = {}) {
    this.defaultTtlMs = (opts.defaultTtlSeconds ?? 300) * 1000;
    this.cache = new LRUCache<string, Envelope>({
      max: opts.max ?? 5000,
      ttl: this.defaultTtlMs,
    });
  }

  get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    return Promise.resolve(entry === undefined ? undefined : (entry.v as T));
  }

  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.cache.set(key, { v: value }, { ttl });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.cache.delete(key);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.cache.clear();
    return Promise.resolve();
  }
}
