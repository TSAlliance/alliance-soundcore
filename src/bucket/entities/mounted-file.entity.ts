import { Mount } from "./mount.entity";

export class MountedFile {
    public directory?: string;
    public filename: string;
    public mount: Mount;
}