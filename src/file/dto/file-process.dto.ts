import { FileDTO } from "../../mount/dtos/file.dto";
import { DBWorkerOptions } from "../../utils/workers/worker.util";
import { File } from "../entities/file.entity";

export enum FileProcessMode {
    SCAN = 0,
    RESCAN
}

export class FileProcessDTO {
    constructor(
        public readonly file: FileDTO,
        public readonly workerOptions: DBWorkerOptions,
        public readonly mode: FileProcessMode = FileProcessMode.SCAN,
        public result?: File
    ) {}
}