import { Mount } from "./mount.entity";

export class MountScan {

    public progress = 0;
    public totalFiles = 0;
    public foundFiles = 0;
    public notIndexedFiles = 0;

    constructor(
        public readonly mount: Mount,
    ) {}

}