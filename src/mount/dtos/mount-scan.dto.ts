import { DBWorkerOptions } from "../../utils/workers/worker.util";
import { Mount } from "../entities/mount.entity";
import { ProgressInfoDTO } from "../worker/progress-info.dto";

export class MountScanProcessDTO {

    constructor(
        public readonly mount: Mount,
        public readonly workerOptions: DBWorkerOptions,
        public progress?: ProgressInfoDTO,
        public readonly isReindex?: boolean,
    ) {}

}