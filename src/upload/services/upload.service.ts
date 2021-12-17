import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { execSync } from 'child_process';
import * as pathToFfmpeg from 'ffmpeg-static';
import { existsSync, mkdirSync, readdirSync, readFileSync, rm, statSync } from 'fs';
import { basename, join } from 'path';
import { UploadedAudioFile } from '../entities/uploaded-file.entity';
import { FileStatus } from '../enums/file-status.enum';
import { UploadedFileRepository } from '../repositories/uploaded-file.repository';
import { SongService } from '../../song/song.service';
import { DeleteResult } from 'typeorm';
import { StorageService, UPLOAD_SONGS_DIR } from './storage.service';
import { SSOUser } from '@tsalliance/sso-nest';
import { Page, Pageable } from 'nestjs-pager';
import { UploadStatusGateway } from '../gateways/upload-status.gateway';

@Injectable()
export class UploadService {
    private logger: Logger = new Logger(UploadService.name)

    constructor(
        @Inject(forwardRef(() => SongService)) private songService: SongService,
        private storageService: StorageService,
        private uploadStatusGateway: UploadStatusGateway,
        public uploadRepository: UploadedFileRepository
    ) {}

    public async findAllByUploaderId(uploaderId: string, pageable: Pageable): Promise<Page<UploadedAudioFile>> {
        return this.uploadRepository.findAll(pageable, {
            where: {
                uploader: {
                    id: uploaderId
                }
            },
            relations: ["metadata"]
        })
    }

    /**
     * Convert UploadedAudioFile to mp3 file format. This encodes the file using ffmpeg and deletes tmp file after completion.
     * @param file UploadedAudioFile data
     * @param tmpFilepath Path to tmp file
     * @returns UploadedAudioFile
     */
    public async convertUploadedFileToMp3(file: UploadedAudioFile, tmpFilepath: string): Promise<UploadedAudioFile> {      
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
     * @returns UploadedAudioFile
     */
    public async create(file: Express.Multer.File, uploader: SSOUser): Promise<UploadedAudioFile> {
        return this.createFromFile(file.path, uploader, file.originalname);
    }

    /**
     * Create database file entry from file on filesystem and transpile file into predefined formats.
     * @param filepath Path to the file
     * @returns UploadedAudioFile
     */
    public async createFromFile(filepath: string, uploader?: SSOUser, originalName?: string): Promise<UploadedAudioFile> {
        const readableBuffer = filepath ? readFileSync(filepath) : undefined;
        if(!readableBuffer) throw new InternalServerErrorException("Error reading file.");

        // Check file format
        if(!(await this.storageService.hasSupportedAudioFormat(filepath))) throw new BadRequestException("File format not supported.");

        // Create data to be inserted in database
        const uploadedFile = new UploadedAudioFile();
        uploadedFile.sizeInBytes = statSync(filepath)?.size || 0;
        uploadedFile.status = uploadedFile.sizeInBytes > 0 ? FileStatus.STATUS_PROCESSING : FileStatus.STATUS_CORRUPTED;
        uploadedFile.uploader = uploader
        uploadedFile.originalName = originalName ? originalName : basename(filepath);

        // Create new entry to retrieve resulting id from database.
        const result = await this.uploadRepository.save(uploadedFile);

        try {
            // Create song entry
            const song = await this.songService.createFromFile(filepath, result.id);
            if(!song) throw new InternalServerErrorException("Could not create metadata from file.")

            // TODO: Separate reindexing from default upload by user?
            // This leads to errors, because reindexing sets uploader to null

            // Convert file to mp3 in background and update entry in database.
            this.convertUploadedFileToMp3(result, filepath).then(async (convertedFile: UploadedAudioFile) => {
                const convertedFilepath = join(UPLOAD_SONGS_DIR, convertedFile.id, `${convertedFile.id}.mp3`);
                uploadedFile.checksum = await this.storageService.generateChecksumOfFile(convertedFilepath);

                uploadedFile.sizeInBytes = statSync(convertedFilepath)?.size || 0;
                uploadedFile.status = convertedFile.sizeInBytes > 0 ? FileStatus.STATUS_AVAILABLE : FileStatus.STATUS_CORRUPTED;
                uploadedFile.metadata = song;    
                
                // Check if the same file already exists (checksum)
                if(await this.storageService.existsFileByChecksum(uploadedFile.checksum)) uploadedFile.status = FileStatus.STATUS_DUPLICATE;

                await this.uploadRepository.update({ id: result.id }, uploadedFile);

                // Cleanup temporary file
                await this.storageService.deleteFile(filepath);

                if(uploadedFile.uploader) {
                    this.uploadStatusGateway.sendStatusToUploader(uploadedFile)
                }
                
            })

            return result;
        } catch (error) {
            if(filepath) this.storageService.deleteFile(filepath);
            this.delete(result.id)
            throw error
        }
    }

    /**
     * Delete uploaded file entry from database.
     * @param id Id of the entry
     * @returns DeleteResult
     */
    public async delete(id: string): Promise<DeleteResult> {
        const uploadedFile = await this.findById(id);
        if(!uploadedFile) return;
        const deletePath = join(`${UPLOAD_SONGS_DIR}`, id);

        return this.uploadRepository.delete(id).then((result) => {
            this.storageService.deleteFile(deletePath);
            return result;
        });
    }

    /**
     * Find uploaded file by id in database.
     * @param uploadId Id of file
     * @returns UploadedAudioFile
     */
    public async findById(uploadId: string): Promise<UploadedAudioFile> {
        return this.uploadRepository.findOne(uploadId);
    }

    /**
     * Get file path for upload id.
     * @param uploadId Id to lookup file for
     * @returns 
     */
    public async findPathById(uploadId: string): Promise<string> {
        const uploadedFile: UploadedAudioFile = await this.findById(uploadId);
        if(!uploadedFile) throw new NotFoundException("Medial file not found.");

        const filePath = join(UPLOAD_SONGS_DIR, uploadId, `${uploadId}.mp3`);
    
        if(!existsSync(filePath)) throw new NotFoundException("Media file not found");
        return filePath
    }

    /**
     * 
     */
    public async reindexAudioUploads() {
        try { 
            const allEntries = (await this.uploadRepository.find()).map((entry) => entry.id);
            const deadDirectoryNames = readdirSync(UPLOAD_SONGS_DIR).filter((dir) => !allEntries.includes(dir));
            const results: UploadedAudioFile[] = []

            for(const dirName of deadDirectoryNames) {
                const fullDir = join(UPLOAD_SONGS_DIR, dirName);
                const filepath = join(fullDir, `${dirName}.mp3`);

                if(!existsSync(filepath)) continue;

                const result = await this.createFromFile(filepath).catch((error) => {
                    console.error(error);
                    return null;
                })

                if(result) results.push(result);
                else this.logger.warn(`Could not reindex '${fullDir}'`);
            }

            for(const dirName of deadDirectoryNames) {
                const fullDir = join(UPLOAD_SONGS_DIR, dirName);

                rm(fullDir, { recursive: true, force: true }, (error) => { if(error) console.error(error) })
            }

            if(results.length > 0) {
                this.logger.log(`Reindexed ${results.length} files.`);
            }
        } catch (error) {
            console.error(error)
        }
    }

    public async convertAudioToHls() {
        //
    }

}
