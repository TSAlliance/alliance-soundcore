import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { Queue } from "bull";
import path from "path";
import { EVENT_FILE_PROCESSED, EVENT_METADATA_CREATED, QUEUE_INDEXER_NAME } from "../../constants";
import { File } from "../../file/entities/file.entity";
import { Song } from "../../song/entities/song.entity";
import { DBWorkerOptions } from "../../utils/workers/worker.util";
import { IndexerProcessDTO, IndexerProcessMode } from "../dtos/indexer-process.dto";

@Injectable()
export class IndexerService {
    private logger: Logger = new Logger(IndexerService.name);

    private readonly workerOptions: DBWorkerOptions = {
        port: parseInt(process.env.DB_PORT),
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASS,
        username: process.env.DB_USER,
        prefix: process.env.DB_PREFIX
    }

    constructor(
        private readonly eventEmitter: EventEmitter2,
        @InjectQueue(QUEUE_INDEXER_NAME) private readonly queue: Queue<IndexerProcessDTO>
    ) {
        this.queue?.on("failed", (job, error) => {
            const filepath = path.join(job.data.file.mount.directory, job.data.file.directory, job.data.file.name);
            this.logger.error(`Failed creating metadata from file ${filepath}: ${error.message}`, error.stack);
        })

        this.queue?.on("completed", (job, result: Song) => {
            if(result) {
                const filepath = path.join(result.file.mount.directory, result.file.directory, result.file.name);
                this.logger.verbose(`Successfully created metadata from file ${filepath}`);
                this.eventEmitter.emit(EVENT_METADATA_CREATED, result);
            }
        })
    }

    /**
     * Handle file processed events.
     * This event is emitted after a file has been processed
     * successfully by the fileService.
     * @param payload File object
     */
    @OnEvent(EVENT_FILE_PROCESSED)
    public handleFileProcessedEvent(payload: File) {
        return this.addToQueue(payload);
    }

    private async addToQueue(file: File, mode: IndexerProcessMode = IndexerProcessMode.SCAN) {
        return this.queue.add(new IndexerProcessDTO(file, mode))
    }

}