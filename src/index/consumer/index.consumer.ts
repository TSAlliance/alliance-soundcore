import { InjectQueue, OnQueueCompleted, OnQueueError, OnQueueFailed, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bull";
import { MountedFile } from "../../bucket/entities/mounted-file.entity";
import { QUEUE_INDEX_NAME } from "../../constants";
import { IndexReportService } from "../../index-report/services/index-report.service";
import { SongService } from "../../song/song.service";
import { StorageService } from "../../storage/storage.service";
import { Index } from "../entities/index.entity";
import { IndexStatus } from "../enum/index-status.enum";
import { IndexService } from "../services/index.service";

export interface IndexResult {
    time?: number;
    index?: Index;
}

@Processor(QUEUE_INDEX_NAME)
export class IndexConsumer {
    private logger: Logger = new Logger(IndexConsumer.name);

    constructor(
        private storageService: StorageService,
        private indexService: IndexService,
        private songService: SongService,
        private indexReportService: IndexReportService,
        @InjectQueue(QUEUE_INDEX_NAME) private indexQueue: Queue<MountedFile>
    ) {}

    public async clearQueue() {
        return this.indexQueue.clean(0, "active")
            .then(() => this.indexQueue.clean(0, "completed"))
            .then(() => this.indexQueue.clean(0, "delayed"))
            .then(() => this.indexQueue.clean(0, "failed"))
            .then(() => this.indexQueue.clean(0, "paused"))
    }

    //@Process()
    public async transcode(job: Job<MountedFile>): Promise<IndexResult> {
        const result: IndexResult = {}
        const start = Date.now();

        // Create or get index if it exists
        const index = await this.indexService.createIndexIfNotExists(job.data, null);
        result.index = index;

        // Only process items that are either PREPARING or PROCESSING
        if(index && index.status != IndexStatus.PROCESSING && index.status != IndexStatus.PREPARING) {
            // this.logger.debug(`File '${job.data.filename}' already indexed. Skipping...`)

            result.time = Date.now() - start;
            return result;
        }

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Update index, this also causes to send an update event to the socket
                this.indexService.updateIndex(index);
                this.logger.verbose(`Indexing file '${job.data.filename}'.`);

                // Generate checksum
                this.storageService.generateChecksumOfIndex(index).then(() => {

                    // Check if an index with same checksum already exists in database
                    this.indexService.existsByChecksum(index.checksum, index.id).then((checksumExists) => {
                        if(checksumExists) {
                            // Duplicate detected
                            index.status = IndexStatus.DUPLICATE;
                            result.index = index;

                            this.indexService.updateIndex(index);
                            resolve(result);
                            return;
                        }

                        this.songService.createFromIndex(index).then((song) => {
                            song.index = undefined;
                            song.albumOrders = [];
                            
                            index.song = song;
                            index.status = IndexStatus.OK;
                            this.indexService.updateIndex(index);

                            result.time = Date.now() - start;
                            result.index = index;

                            this.logger.verbose(`Finished indexing file '${job?.data?.filename}' in ${result?.time || 0}ms.`);

                            resolve(result);
                        }).catch((error: Error) => {
                            this.logger.error(error);
                            // Error while creating song from index
                            this.setError(index, error, "Error occured while checking for duplicate checksum");
                            reject(error);
                        })
                    }).catch((error: Error) => {
                        // Error while checking for duplicate checksums
                        this.setError(index, error, "Error occured while checking for duplicate checksum");
                        reject(error);
                    })
                }).catch((error: Error) => {
                    // Error while generating checksum
                    this.setError(index, error, "Error occured while generating checksum");
                    reject(error);
                })
            }, 2000)
        })
    }

    private setError(index: Index, error: Error, context?: string) {
        // Append error to report
        this.indexReportService.appendError(index.report, `${context ? context + ': ' : ''}${error.message}`);

        // Update index to status ERRORED
        index.status = IndexStatus.ERRORED;
        this.indexService.updateIndex(index);
    }

    @OnQueueError()
    public onError(error: Error) {
        console.error(error);
    }

    @OnQueueFailed()
    public onFailed(job: Job<MountedFile>, error: Error) {
        console.error(error);
    }

    @OnQueueCompleted()
    public onComplete(job: Job<MountedFile>, result: IndexResult) {
        this.indexReportService.appendInfo(result.index.report, `Finished indexing file '${job.data.filename}' in ${result.time || 0}ms. Index status: ${result.index.status.toString().toUpperCase()}`)
        this.indexService.updateIndex(result.index);
    }
}