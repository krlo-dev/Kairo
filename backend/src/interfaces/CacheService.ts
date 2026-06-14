// Abstracción de cache para permitir swap LRU (v.1) → Redis (v.2)
// sin tocar la lógica de negocio.

export interface CacheService {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
