import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { readdirSync } from "fs";
import { In } from "typeorm";
import { FileStatus } from "../enums/file-status.enum";
import { UploadedFileRepository } from "../repositories/uploaded-file.repository";
import { UPLOAD_SONGS_DIR } from "../services/storage.service";
import { UploadService } from "../services/upload.service";

@Injectable()
export class CleanUploadService {
    private readonly logger = new Logger("Cleanup");

    // TODO: If audio is reindexed, it may happen that it is processed so fast, that checksums are calculated at exact same times.
    // This causes duplicates not being detected. Therefor these duplicates need to be cleaned up

    constructor(private uploadRepository: UploadedFileRepository, private uploadService: UploadService) {
        this.handleUploadCleanup();
    }

    /**
     * Cleanup dead entries on system and database
     * This is triggered every da at 8 o'clock
     */
    @Cron("0 0 8 * * *")
    public async handleUploadCleanup() {
        this.logger.log("Cleaning up uploads");

        await this.cleanDeadEntries();
        await this.cleanupProcessingFiles();
        // await this.cleanDeadFiles();

        this.uploadService.reindexAudioUploads();
        this.logger.log("Cleanup done");
    }

    /**
     * Delete database entries that have no
     */
    private async cleanDeadEntries() {
        const audioDirectories = readdirSync(UPLOAD_SONGS_DIR);
        const deadEntries = (await this.uploadRepository.find()).filter((entry) => !audioDirectories.includes(entry.id)).map((entry) => entry.id);

        if(deadEntries.length > 0) {
            this.logger.log(`Found ${deadEntries.length} entries that have no existing file, but are listed in the database. Deleting...`);
            await this.uploadRepository.delete({ id: In(deadEntries)});
        }
    }

    /**
     * Delete all database entries that are stuck in processing
     */
    private async cleanupProcessingFiles() {
        const processingEntries = (await this.uploadRepository.find({ where: {status: FileStatus.STATUS_PROCESSING }})).map((val) => val.id);
        await this.uploadRepository.delete({ id: In(processingEntries)})
    }

    /**
     * Delete all files, that have no database entry.
     */
    private async cleanDeadFiles() {
        /*const files = readdirSync(UPLOAD_SONGS_DIR);
        console.log(files)*/
        // TODO: Maybe add ability for users to trigger re-indexing process, so that missing entries in database can be recreated
    }

    
}