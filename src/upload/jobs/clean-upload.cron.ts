import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { readdirSync } from "fs";
import { join } from "path";
import { In } from "typeorm";
import { FileStatus } from "../enums/file-status.enum";
import { UploadedFileRepository } from "../repositories/uploaded-file.repository";
import { StorageService, UPLOAD_SONGS_DIR } from "../services/storage.service";
import { UploadService } from "../services/upload.service";

type DuplicateAudioFile = { checksum: string, times: number }

@Injectable()
export class CleanUploadService {
    private readonly logger = new Logger("Cleanup");

    constructor(private uploadRepository: UploadedFileRepository, private uploadService: UploadService, private storageService: StorageService) {
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
        await this.cleanupDuplicateChecksums();
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
     * Delete all files that may be duplicates. This is checked via the indexed checksum in the database
     */
    private async cleanupDuplicateChecksums() {
        const duplicateEntries = (await this.uploadRepository.find());
        const duplicateGrouped = duplicateEntries.reduce((prev: DuplicateAudioFile[], current) => {
            const i = prev.findIndex( x => x.checksum === current.checksum);
            return i === -1 ? prev.push({ checksum : current.checksum, times : 1 }) : prev[i].times++, prev;
        }, [])

        const duplicateChecksums = duplicateGrouped.filter((value) => value.times > 1).map((value) => value.checksum as string);
        const duplicateIds = duplicateEntries.filter((entry) => duplicateChecksums.includes(entry.checksum)).map((entry) => entry.id).slice(1);

        if(duplicateIds.length <= 0) {
            return;
        }

        this.logger.warn(`Found ${duplicateIds.length + 1} duplicate files. Deleting duplicates (${duplicateIds.length})...`)

        await this.uploadRepository.delete({ checksum: In(duplicateIds) }).then(() => {
            for(const id of duplicateIds) {
                this.storageService.deleteDirectory(join(UPLOAD_SONGS_DIR, id));
            }

            this.logger.log("Successfully cleaned up duplicate files.")
        }).catch((reason) => {
            this.logger.error("Could not clean up all duplicate files on system: ")
            this.logger.error(reason);
        })
    }

    
}