import Client from "ioredis";
import Redlock, { RedlockAbortSignal } from "redlock";
import { RedlockError } from "../../exceptions/redlock.exception";

export abstract class RedisLockableService {
    private readonly redisClient;

    constructor() {
        this.redisClient = new Client({ host: process.env.REDIS_HOST || "127.0.0.1", port: parseInt(process.env.REDIS_PORT) || 6379, password: process.env.REDIS_PASS || "" });
    }

    /**
     * Acquire a lock for named resource. Default duration is 5s
     * and the lock will be automatically extended if only 500ms are left.
     * At maximum there will be 10 retries, each with a 500ms delay. So in worst case
     * acquiring a lock could take 5s.
     * @param name Name of the lock
     * @param waitForLock Define, if acquiring the lock should be forced and not aborted
     * @returns Lock
     */
    protected async lock<T>(name: string, routine?: (signal: RedlockAbortSignal) => Promise<T>, waitForLock = false, duration = 5000): Promise<T> {
        const redlock = new Redlock([ this.redisClient ]);
        
        if(waitForLock) {
            let acquiredLock = false;
            let result;

            do {
                result = await this.acquireLock<T>(redlock, name, duration, true, routine).catch(() => null);
                acquiredLock = typeof result !== "undefined" && result != null;
            } while (!acquiredLock);

            return result;
        }

        return this.acquireLock<T>(redlock, name, duration, false, routine);
    }

    private async acquireLock<T>(redlock: Redlock, key: string, duration: number, wait = false, routine?: (signal: RedlockAbortSignal) => Promise<T>) {
        return redlock.using([key], duration, {
            driftFactor: 0.01,
            retryCount: 10,
            retryDelay: 1000, //ms
            retryJitter: 5000, // max time randomly added to retries
            automaticExtensionThreshold: 1000 // min remaining time on a lock before api requests extension of the lock
        }, (signal) => {
            if(signal.aborted && wait) throw new RedlockError();
            return routine(signal);
        });
    }

}