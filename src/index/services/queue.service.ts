import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Index } from "../entities/index.entity";
import { IndexReportService } from "../../index-report/services/index-report.service";
import { IndexService } from "./index.service";
import { debounceTime, Observable, Subject } from "rxjs";

export type QueueEndReason = "errored" | "done"

export const MOUNT_INDEX_START = "onMountIndexStart"
export const MOUNT_INDEX_END = "onMountIndexEnd"

@Injectable()
export class QueueService {
    private logger: Logger = new Logger(QueueService.name)

    private readonly _onItemAddedSubject: Subject<void> = new Subject();
    private readonly $onItemAdded: Observable<void> = this._onItemAddedSubject.asObservable().pipe(debounceTime(4000))

    private readonly _queue: Index[] = [];
    private readonly _mounts: Record<string, number> = {};
    private _currentlyProcessing: Index = null;
    private _hasCooldown = false;

    public get size(): number {
        return this._queue.length;
    }

    constructor(
        private indexReportService: IndexReportService,
        private eventEmitter: EventEmitter2,
        @Inject(forwardRef(() => IndexService)) private indexService: IndexService
    ) {
        this.$onItemAdded.subscribe(() => {
            this.logger.log("Found new items in queue.")
            this.next();
        })
    }

    public async enqueue(index: Index) {
        // Add to queue
        this._queue.push(index);

        // Update amount of queued indices per mount
        // This is later used to send status updates on wether a mount
        // is currently processed or not
        if(!this._mounts[index.mount.id]) this._mounts[index.mount.id] = 1;
        else this._mounts[index.mount.id] = this._mounts[index.mount.id]+1;

        this.indexReportService.appendInfo(index.report, `Index has been added to queue. (Position #${this.size})`)
        this._onItemAddedSubject.next();
        this.logger.log("Enqueued file " + index?.filename + " (" + this._queue.length + ")")
    }

    public async enqueueMultiple(indices: Index[]) {
        this.logger.log(`Adding ${indices.length} items to queue. Depending on the amount this could take some time.`)
        this._queue.push(...indices);
        // const reports: IndexReport[] = [];

        for(const index of indices) {
            // if(index.report) reports.push(index.report)
            if(!this._mounts[index.mount.id]) this._mounts[index.mount.id] = 1;
            else this._mounts[index.mount.id] = this._mounts[index.mount.id]+1;
        }

        // this.indexReportService.appendInfoMultiple(reports, `Index has been added to queue (Batch-Size: ${indices.length}, Queue-Size: ${this.size})`)
        this._onItemAddedSubject.next();
        this.logger.log(`Enqueued ${indices.length} file(s) (Queue size: ${this._queue.length})`);
    }

    public async dequeue(): Promise<Index> {
        const item = this._queue.splice(0, 1)[0];
        if(this._mounts[item.mount.id] <= 1) delete this._mounts[item.mount.id];
        if(this._mounts[item.mount.id] > 1) this._mounts[item.mount.id] -= 1;

        if(item) await this.indexReportService.appendInfo(item.report, `Index has been taken from queue.`)
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
        // TODO: Does not work, because FE constantly receives updates about the status
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
        } else {
            this.logger.log("Queue is empty.")
        }

        this.indexReportService.appendInfo(index.report, `Processing ended. (Reason: ${reason.toUpperCase()})`)
    }

    public async onIndexStart(index: Index) {
        this.logger.log(`Indexing file '${index.filename}'`)
        this._currentlyProcessing = index;

        this.indexReportService.appendInfo(index.report, `Processing started`)
        this.eventEmitter.emitAsync(MOUNT_INDEX_START, index.mount)
    }

    private async next() {
        console.log("next(): isEmpty? " + this.isEmpty() + "; cooldown? " + this._hasCooldown + "; isProcessing? " + !!this._currentlyProcessing);
        if(this.isEmpty() || this._hasCooldown || !!this._currentlyProcessing) return;
        console.log("next()");

        const nextItem = await this.dequeue();
        this._currentlyProcessing = nextItem;
        this.indexService.processIndex(nextItem);
    }

}