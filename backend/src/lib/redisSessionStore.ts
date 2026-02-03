import session from 'express-session';
import { redis } from './redis.js';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class RedisSessionStore extends session.Store {
  private prefix: string;

  constructor(prefix: string = 'sess:') {
    super();
    this.prefix = prefix;
  }

  private getKey(sessionId: string): string {
    return `${this.prefix}${sessionId}`;
  }

  private getTtlMs(sessionData: session.SessionData): number {
    const maxAge = sessionData.cookie?.maxAge;
    if (typeof maxAge === 'number') {
      return Math.max(maxAge, 0);
    }

    const expires = sessionData.cookie?.expires;
    if (expires) {
      const expiryTime = expires instanceof Date ? expires.getTime() : new Date(expires).getTime();
      return Math.max(expiryTime - Date.now(), 0);
    }

    return DEFAULT_TTL_MS;
  }

  override async get(
    sessionId: string,
    callback: (err?: unknown, session?: session.SessionData | null) => void
  ): Promise<void> {
    try {
      const key = this.getKey(sessionId);
      const data = await redis.get(key);
      if (!data) {
        callback(undefined, null);
        return;
      }
      callback(undefined, JSON.parse(data) as session.SessionData);
    } catch (error) {
      callback(error);
    }
  }

  override async set(
    sessionId: string,
    sessionData: session.SessionData,
    callback?: (err?: unknown) => void
  ): Promise<void> {
    try {
      const key = this.getKey(sessionId);
      const ttlMs = this.getTtlMs(sessionData);
      const payload = JSON.stringify(sessionData);
      if (ttlMs > 0) {
        await redis.set(key, payload, 'PX', ttlMs);
      } else {
        await redis.set(key, payload);
      }
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  override async destroy(
    sessionId: string,
    callback?: (err?: unknown) => void
  ): Promise<void> {
    try {
      const key = this.getKey(sessionId);
      await redis.del(key);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  override async touch(
    sessionId: string,
    sessionData: session.SessionData,
    callback?: (err?: unknown) => void
  ): Promise<void> {
    try {
      const key = this.getKey(sessionId);
      const ttlMs = this.getTtlMs(sessionData);
      if (ttlMs > 0) {
        await redis.pexpire(key, ttlMs);
      }
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
}
