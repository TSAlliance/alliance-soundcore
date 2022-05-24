import { Mount } from "../entities/mount.entity";

export class MountScanResultDTO {

    constructor(
        public readonly files: string[],
        public readonly mount: Mount
    ) {}

}