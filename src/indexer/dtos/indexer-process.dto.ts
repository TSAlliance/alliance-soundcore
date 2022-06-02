import { File } from "../../file/entities/file.entity";
import { DBWorkerOptions } from "../../utils/workers/worker.util";

export class IndexerProcessDTO {

    constructor(
        public readonly file: File,
        public readonly workerOptions: DBWorkerOptions
    ) {}

}