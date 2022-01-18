import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { Index } from "../entities/index.entity";
import { IndexService } from "./index.service";

export type QueueEndReason = "errored" | "done"

@Injectable()
export class QueueService {
    private logger: Logger = new Logger(QueueService.name)

    private readonly _queue: Index[] = [];
    private _currentlyProcessing: Index = null;
    private _hasCooldown = false;

    constructor(
        @Inject(forwardRef(() => IndexService)) private indexService: IndexService
    ) {}

    public async enqueue(index: Index) {
        const wasEmpty = this.isEmpty();
        // Add to queue
        this._queue.push(index);
        this.logger.log("Enqueued file " + index?.filename)

        // Check if queue is empty and nothing is in progress
        if(wasEmpty && !this._currentlyProcessing) {
            this.next();
        }

        console.log(wasEmpty, this._currentlyProcessing)
    }

    public async dequeue(): Promise<Index> {
        const item = this._queue.splice(0, 1)[0];
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
        this._hasCooldown = true;

        if(reason == "done") {
            this.logger.log(`Successfully indexed file ${index?.filename}`)
        } else {
            this.logger.log(`Indexed file ${index?.filename} with errors.`)
        }

        if(!this.isEmpty()) {
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
    }

    private async next() {
        if(this.isEmpty() || !!this._currentlyProcessing || this._hasCooldown) return;

        const nextItem = await this.dequeue();
        console.log("next: " + nextItem.filename)
        this.indexService.processIndex(nextItem);
    }

}