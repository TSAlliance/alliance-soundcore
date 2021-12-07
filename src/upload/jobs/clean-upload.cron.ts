import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { readdirSync } from "fs";
import { FileStatus } from "../enums/file-status.enum";
import { UPLOAD_SONGS_DIR } from "../services/storage.service";
import { UploadService } from "../services/upload.service";

@Injectable()
export class CleanUploadService {
    private readonly logger = new Logger(CleanUploadService.name);

    constructor(private uploadService: UploadService) {

    }

    /**
     * Cleanup dead entries on system and database
     * This is triggered every da at 8 o'clock
     */
    @Cron("0 0 8 * * *")
    public async handleUploadCleanup() {
        this.logger.log("Cleaning up uploads");

        // TODO:
        await this.cleanDeadEntries();
        await this.cleanDeadFiles();
    }

    private async cleanDeadEntries() {
        const deadUploads = await this.uploadService.uploadRepository.find({ where: { sizeInBytes: 0, status: FileStatus.STATUS_CORRUPTED,  }})

    }

    private async cleanDeadFiles() {
        const files = readdirSync(UPLOAD_SONGS_DIR);
        console.log(files)
    }

    
}