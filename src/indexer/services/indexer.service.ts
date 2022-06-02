import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bull";
import path from "path";
import { QUEUE_INDEXER_NAME } from "../../constants";
import { File } from "../../file/entities/file.entity";
import { DBWorkerOptions } from "../../utils/workers/worker.util";
import { IndexerProcessDTO } from "../dtos/indexer-process.dto";

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
        @InjectQueue(QUEUE_INDEXER_NAME) private readonly queue: Queue<IndexerProcessDTO>
    ) {
        this.queue.on("failed", (job, error) => {
            const filepath = path.join(job.data.file.mount.directory, job.data.file.directory, job.data.file.name);
            this.logger.error(`Failed creating metadata from file ${filepath}: ${error.message}`, error.stack);
        })

        this.queue.on("completed", (job) => {
            const filepath = path.join(job.data.file.mount.directory, job.data.file.directory, job.data.file.name);
            this.logger.verbose(`Successfully created metadata from file ${filepath}`);
        })
    }

    public async addToQueue(file: File) {
        return this.queue.add(new IndexerProcessDTO(file, this.workerOptions))
    }

}