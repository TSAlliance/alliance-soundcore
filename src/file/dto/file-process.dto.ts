import { FileDTO } from "../../mount/dtos/file.dto";
import { DBWorkerOptions } from "../../utils/workers/worker.util";

export class FileProcessDTO {
    constructor(
        public readonly file: FileDTO,
        public readonly workerOptions: DBWorkerOptions
    ) {}
}