import { LRUCache } from 'lru-cache';
import type { CacheService } from '../interfaces/CacheService.js';

interface Options {
  max?: number;
  defaultTtlSeconds?: number;
}

export class LruCacheService implements CacheService {
  private cache: LRUCache<string, unknown>;
  private defaultTtlMs: number;

  constructor(opts: Options = {}) {
    this.defaultTtlMs = (opts.defaultTtlSeconds ?? 300) * 1000;
    this.cache = new LRUCache({
      max: opts.max ?? 5000,
      ttl: this.defaultTtlMs,
    });
  }

  get<T>(key: string): Promise<T | undefined> {
    const value = this.cache.get(key) as T | undefined;
    return Promise.resolve(value);
  }

  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.cache.set(key, value, { ttl });
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
