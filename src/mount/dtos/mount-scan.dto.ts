import { DBWorkerOptions } from "../../utils/workers/worker.util";
import { Mount } from "../entities/mount.entity";

export class MountScanProcessDTO {

    constructor(
        public readonly mount: Mount,
        public readonly workerOptions: DBWorkerOptions,
        public readonly isReindex?: boolean
    ) {}

}