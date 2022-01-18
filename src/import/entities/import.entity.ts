import { v4 as uuidv4 } from "uuid"
import { Index } from "../../index/entities/index.entity";
import { User } from "../../user/entities/user.entity";

export type ImportStatus = "preparing" | "downloading" | "upgradeIndex" | "errored"
export class ImportEntity {

    public id: string = uuidv4();
    public url: string;
    public startTime: number;
    public dstFilepath: string;
    public dstFilename: string;
    public downloadProgress: number;
    public downloadableUrl: string;

    public upgradeIndex: Index;
    public metadata: {
        title?: string,
        duration?: number,
        thumbnail_url?: string,
        description?: string,
        youtubeUrl?: string,
        youtubeStart?: number,
        albums?: string[],
        artists?: string[]
    }

    public importer?: User;
    public status: ImportStatus = "preparing";

}