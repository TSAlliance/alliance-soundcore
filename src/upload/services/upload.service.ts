import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { execSync } from 'child_process';
import * as pathToFfmpeg from 'ffmpeg-static';
import { existsSync, mkdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { UploadedFile } from '../entities/uploaded-file.entity';
import { FileStatus } from '../enums/file-status.enum';
import { FileType } from '../enums/file-type.enum';
import { UploadedFileRepository } from '../repositories/uploaded-file.repository';
import { SongService } from '../../song/song.service';
import { DeleteResult } from 'typeorm';
import { StorageService, UPLOAD_SONGS_DIR } from './storage.service';

@Injectable()
export class UploadService {

    constructor(
        @Inject(forwardRef(() => SongService)) private songService: SongService,
        private storageService: StorageService,
        public uploadRepository: UploadedFileRepository
    ) {}

    /**
     * Convert UploadedFile to mp3 file format. This encodes the file using ffmpeg and deletes tmp file after completion.
     * @param file UploadedFile data
     * @param tmpFilepath Path to tmp file
     * @returns UploadedFile
     */
    public async convertUploadedFileToMp3(file: UploadedFile, tmpFilepath: string): Promise<UploadedFile> {      
        return new Promise((resolve) => {
            setTimeout(() => {
                const filepath = tmpFilepath;
                const destFiledir = join(UPLOAD_SONGS_DIR, file.id);
                const destFilepath = join(destFiledir, `${file.id}.mp3`);

                // Create and convert file to mp3
                if(!existsSync(destFiledir)) mkdirSync(destFiledir, { recursive: true });
                try {
                    execSync(`${pathToFfmpeg} -i ${filepath} -vn -ac 2 -b:a 192k ${destFilepath}`, { stdio: "pipe" });
                } catch (error) {
                    console.log(error.stderr.toString())

                    // Clean everything up on error
                    this.storageService.deleteFile(destFiledir);
                    this.storageService.deleteFile(destFilepath);

                    file.status = FileStatus.STATUS_CORRUPTED;
                    file.sizeInBytes = 0;
                    resolve(file);
                }
                
                // Update file status
                file.status = FileStatus.STATUS_AVAILABLE;
                file.sizeInBytes = statSync(destFilepath).size
                resolve(file);
            }, 1000)
        })
    }

    /**
     * Create database entry for new uploaded file.
     * @param file File metadata
     * @returns UploadedFile
     */
    public async create(file: Express.Multer.File): Promise<UploadedFile> {
        const readableBuffer = file.path ? readFileSync(file.path) : file.buffer;

        // Check file format
        if(!(await this.storageService.hasSupportedAudioFormat(file))) throw new BadRequestException("File format not supported.");

        // Create data to be inserted in database
        const uploadedFile = new UploadedFile();
        uploadedFile.fileType = FileType.FILE_SONG;
        uploadedFile.sizeInBytes = file.size;
        uploadedFile.status = FileStatus.STATUS_PROCESSING;

        // Create new entry to retrieve resulting id from database.
        const result = await this.uploadRepository.save(uploadedFile);

        try {
            // Create song entry
            await this.songService.createMetadataFromBuffer(file.path, result);

            // Convert file to mp3 in background and update entry in database.
            this.convertUploadedFileToMp3(result, file.path).then(async (convertedFile: UploadedFile) => {
                uploadedFile.checksum = await this.storageService.generateChecksumOfFile(readableBuffer);

                // Check if the same file already exists (checksum)
                if(await this.storageService.existsFileByChecksum(uploadedFile.checksum)) uploadedFile.status = FileStatus.STATUS_DUPLICATE;

                this.uploadRepository.update({ id: result.id }, convertedFile);

                // Cleanup temporary file
                this.storageService.deleteFile(file.path);
            })

            return result;
        } catch (error) {
            if(file.path) this.storageService.deleteFile(file.path);
            this.delete(result.id)
            throw new InternalServerErrorException()
        }
    }

    /**
     * Delete uploaded file entry from database.
     * @param id Id of the entry
     * @returns DeleteResult
     */
    public async delete(id: string): Promise<DeleteResult> {
        const uploadedFile = await this.findById(id);
        let deletePath;

        if(uploadedFile.fileType == FileType.FILE_SONG) {
            deletePath = join(`${UPLOAD_SONGS_DIR}`, id);
        }

        return this.uploadRepository.delete(id).then((result) => {
            this.storageService.deleteFile(deletePath);
            return result;
        });
    }

    /**
     * Find uploaded file by id in database.
     * @param uploadId Id of file
     * @returns UploadedFile
     */
    public async findById(uploadId: string): Promise<UploadedFile> {
        return this.uploadRepository.findOne(uploadId);
    }

    /**
     * Get file path for upload id.
     * @param uploadId Id to lookup file for
     * @returns 
     */
    public async findPathById(uploadId: string): Promise<string> {
        const uploadedFile: UploadedFile = await this.findById(uploadId);
        if(!uploadedFile) throw new NotFoundException("Medial file not found.");

        let filePath = null;
        if(uploadedFile.fileType == FileType.FILE_SONG) {
            filePath = join(UPLOAD_SONGS_DIR, uploadId, `${uploadId}.mp3`);
        }
    
        if(!existsSync(filePath)) throw new NotFoundException("Media file not found");
        return filePath
    }

    public async convertAudioToHls() {
        //
    }

}
