import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Index } from "../entities/index.entity";
import { IndexService } from "./index.service";

export type QueueEndReason = "errored" | "done"

export const MOUNT_INDEX_START = "onMountIndexStart"
export const MOUNT_INDEX_END = "onMountIndexEnd"

@Injectable()
export class QueueService {
    private logger: Logger = new Logger(QueueService.name)

    private readonly _queue: Index[] = [];
    private readonly _mounts: Record<string, number> = {};
    private _currentlyProcessing: Index = null;
    private _hasCooldown = false;

    constructor(
        private eventEmitter: EventEmitter2,
        @Inject(forwardRef(() => IndexService)) private indexService: IndexService
    ) {}

    public async enqueue(index: Index) {
        // Add to queue
        this._queue.push(index);
        this.logger.log("Enqueued file " + index?.filename + " (" + this._queue.length + ")")

        // Update amount of queued indices per mount
        // This is later used to send status updates on wether a mount
        // is currently processed or not
        if(!this._mounts[index.mount.id]) this._mounts[index.mount.id] = 1;
        else this._mounts[index.mount.id] += 1;

        this.next();
    }

    public async dequeue(): Promise<Index> {
        const item = this._queue.splice(0, 1)[0];

        if(this._mounts[item.mount.id]) delete this._mounts[item.mount.id];

        return item;
    }

    public isEmpty(): boolean {
        return this._queue.length <= 0;
    }

    public peek(): Index {
        return this._queue[0];
    }

    public async onIndexEnded(index: Index, reason: QueueEndReason) {
        this._currentlyProcessing = null;

        if(reason == "done") {
            this.logger.log(`Successfully indexed file ${index?.filename}`)
        } else {
            this.logger.warn(`Indexed file ${index?.filename} with errors.`)
        }

        // Mount is ready, if no index is left associated with the mount 
        if(!this._mounts[index.mount.id] || this._mounts[index.mount.id] <= 0) {
            this.eventEmitter.emitAsync(MOUNT_INDEX_END, index.mount)
        }

        if(!this.isEmpty()) {
            this._hasCooldown = true;
            this.logger.log("Applied short cooldown to queue. Processing next item in 2s");
            setTimeout(() => {
                this._hasCooldown = false;
                this.next();
            }, 2000)
        }
    }

    public async onIndexStart(index: Index) {
        this.logger.log(`Indexing file '${index.filename}'`)
        this._currentlyProcessing = index;

        this.eventEmitter.emitAsync(MOUNT_INDEX_START, index.mount)
    }

    private async next() {
        if(this.isEmpty() || !!this._currentlyProcessing || this._hasCooldown) return;

        const nextItem = await this.dequeue();
        this.indexService.processIndex(nextItem);
    }

}