/**
 * Simple in-memory cache manager with TTL (Time To Live) support
 */
export class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Set a value in the cache with a TTL (Time To Live) in milliseconds
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time To Live in milliseconds (default: 30000ms = 30s)
   */
  set(key: string, value: any, ttl: number = 30000): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get a value from the cache if it exists and hasn't expired
   * @param key The cache key
   * @returns The cached value or null if not found or expired
   */
  get(key: string): any {
    const cacheItem = this.cache.get(key);
    
    if (!cacheItem) {
      return null;
    }

    // Check if the cache item has expired
    const now = Date.now();
    if (now - cacheItem.timestamp > cacheItem.ttl) {
      // Cache expired, remove it
      this.cache.delete(key);
      return null;
    }

    return cacheItem.data;
  }

  /**
   * Check if a key exists in the cache and hasn't expired
   * @param key The cache key
   * @returns True if the key exists and hasn't expired, false otherwise
   */
  has(key: string): boolean {
    const cacheItem = this.cache.get(key);
    
    if (!cacheItem) {
      return false;
    }

    // Check if the cache item has expired
    const now = Date.now();
    if (now - cacheItem.timestamp > cacheItem.ttl) {
      // Cache expired, remove it
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove a key from the cache
   * @param key The cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the time remaining before a cache item expires
   * @param key The cache key
   * @returns Time remaining in milliseconds, or -1 if the key doesn't exist
   */
  getTimeToLive(key: string): number {
    const cacheItem = this.cache.get(key);
    
    if (!cacheItem) {
      return -1;
    }

    const now = Date.now();
    const elapsed = now - cacheItem.timestamp;
    const remaining = cacheItem.ttl - elapsed;
    
    return remaining > 0 ? remaining : 0;
  }
}
