import { InjectQueue, OnGlobalQueueError, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bull";
import { MountedFile } from "../../bucket/entities/mounted-file.entity";
import { IndexReportService } from "../../index-report/services/index-report.service";
import { Index } from "../entities/index.entity";
import { IndexStatus } from "../enum/index-status.enum";
import { IndexService } from "../services/index.service";

export interface IndexResult {
    time: number;
    index: Index;
}

@Processor("index-queue")
export class IndexConsumer {
    private logger: Logger = new Logger(IndexConsumer.name);

    constructor(
        private indexService: IndexService,
        private indexReportService: IndexReportService,
        @InjectQueue("index-queue") private indexQueue: Queue<MountedFile>
    ) {}

    public async clearQueue() {
        return this.indexQueue.clean(0, "active")
            .then(() => this.indexQueue.clean(0, "completed"))
            .then(() => this.indexQueue.clean(0, "delayed"))
            .then(() => this.indexQueue.clean(0, "failed"))
            .then(() => this.indexQueue.clean(0, "paused"))
    }

    @Process()
    public async transcode(job: Job<MountedFile>): Promise<void> {
        const start = Date.now();
        const existsIndex = await this.indexService.findByMountedFile(job.data);

        // Only process items that are either PREPARING or PROCESSING
        if(existsIndex && existsIndex.status != IndexStatus.PROCESSING && existsIndex.status != IndexStatus.PREPARING) {
            return null;
        }

        this.logger.verbose(`Indexing file '${job.data.filename}'.`);
        const index = await this.indexService.createIndexIfNotExists(job.data, null);
        const cooldownMs = 3000;

        return new Promise((resolve, reject) => {
            setTimeout(() => {


                this.logger.verbose(`Finished indexing file '${job?.data?.filename}' in ${Date.now() - start || 0}ms.`);
                resolve()
            }, cooldownMs)
        })
    }

    @OnGlobalQueueError()
    public onError(error: Error) {
        console.error(error)
    }
}