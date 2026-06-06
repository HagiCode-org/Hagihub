export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

interface GithubApiCache {
  get<T>(key: string): T | null;
  set<T>(key: string, data: T): void;
  invalidate(key: string): void;
  invalidateAll(): void;
}

const DEFAULT_GITHUB_API_CACHE_TTL_MS = 60_000;

export function createGithubApiCache(ttlMs = DEFAULT_GITHUB_API_CACHE_TTL_MS): GithubApiCache {
  const store = new Map<string, CacheEntry<unknown>>();

  return {
    get<T>(key: string): T | null {
      const entry = store.get(key);

      if (!entry) {
        return null;
      }

      if (Date.now() - entry.cachedAt > ttlMs) {
        store.delete(key);
        return null;
      }

      return entry.data as T;
    },
    set<T>(key: string, data: T): void {
      store.set(key, {
        data,
        cachedAt: Date.now(),
      });
    },
    invalidate(key: string): void {
      store.delete(key);
    },
    invalidateAll(): void {
      store.clear();
    },
  };
}
