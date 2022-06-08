import Client from "ioredis";
import Redlock, { Lock, RedlockAbortSignal } from "redlock";

export abstract class RedisLockableService {

    /**
     * Acquire a lock for named resource. Default duration is 5s
     * and the lock will be automatically extended if only 500ms are left.
     * At maximum there will be 10 retries, each with a 500ms delay. So in worst case
     * acquiring a lock could take 5s.
     * @param name Name of the lock
     * @returns Lock
     */
    protected async lock<T>(name: string, routine?: (signal: RedlockAbortSignal) => Promise<T>, duration = 5000): Promise<T> {
        const redis = new Client({ host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT), password: process.env.REDIS_PASS });
        const redlock = new Redlock([ redis ]);

        return redlock.using([name], duration, {
            driftFactor: 0.01,
            retryCount: 10,
            retryDelay: 500, //ms
            retryJitter: 100, // max time randomly added to retries
            automaticExtensionThreshold: 500 // min remaining time on a lock before api requests extension of the lock
        }, routine);
    }

}