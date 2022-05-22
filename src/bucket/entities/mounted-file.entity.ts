import path from "node:path";
import { Mount } from "../../mount/entities/mount.entity";

export class MountedFile {
    public directory: string;
    public filename: string;
    public mount: Mount;

    constructor(directory: string, filename: string, mount: Mount) {
        this.directory = directory;
        this.filename = filename;
        this.mount = mount;
    }

    public get fullPath(): string | null {
        return path.join(this.directory || ".", this.filename);
    }

    public get bullJobId(): string {
        return this.mount.id+this.directory+this.filename
    }
}