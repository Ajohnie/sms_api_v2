import { CACHE_MANAGER, Inject, Injectable } from "@nestjs/common";
import { Cache } from "cache-manager";
import { AppUtils } from "../lib";

const CACHE_KEYS = "all-cache-keys";

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {
  }

  getCacheById = (id: string) => {
    return new Promise<any | null>(async (resolve, reject) => {
      try {
        if (1) {
          return resolve(null);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide cache identifier");
        }
        if (typeof id === "object") {
          return reject(`unsupported cache record identifier, contact admin`);
        }
        const cacheResponse = await this.cache.get(id);
        if (cacheResponse) {
          return resolve(cacheResponse);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  };

  saveCache = (cacheKey: string, data: any): Promise<boolean> => {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (1) {
          return resolve(true);
        }
        const sanitized: any = AppUtils.sanitizeObject(data);
        if (AppUtils.stringIsSet(cacheKey)) {
          const cacheResponse = this.cache.set(cacheKey, sanitized);
          if (cacheResponse !== null) {
            const cachedKeys: string[] = (await this.cache.get(CACHE_KEYS)) || [];
            const keyIndex = cachedKeys.indexOf(cacheKey);
            if (keyIndex < 0) {
              cachedKeys.push(cacheKey);
              await this.cache.set(CACHE_KEYS, cachedKeys);
            }
            return resolve(true);
          }
          return resolve(false);
        }
        return resolve(false);
      } catch (e) {
        return reject(e);
      }
    });
  };

  cleanCache = (levelAlias: string, studentName: string) => {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (1) {
          return resolve(true);
        }
        const cachedKeys: string[] = (await this.cache.get(CACHE_KEYS)) || [];
        for (const cachedKey of cachedKeys) {
          const isKey = AppUtils.findInString(levelAlias, cachedKey) || AppUtils.findInString(studentName, cachedKey);
          if (isKey) {
            await this.cache.set(cachedKey, null);
          }
        }
        return resolve(true);
      } catch (e) {
        return reject(e);
      }
    });
  };
}

