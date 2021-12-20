import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { execSync } from 'child_process';
import pathToFfmpeg from 'ffmpeg-static';
import { existsSync, mkdirSync, readFileSync, statSync } from 'fs';
import { basename, join } from 'path';
import { UploadedAudioFile } from '../entities/uploaded-file.entity';
import { FileStatus } from '../enums/file-status.enum';
import { UploadedFileRepository } from '../repositories/uploaded-file.repository';
import { SongService } from '../../song/song.service';
import { DeleteResult } from 'typeorm';
import { StorageService, UPLOAD_SONGS_DIR } from '../../storage/storage.service';
import { SSOUser } from '@tsalliance/sso-nest';
import { Page, Pageable } from 'nestjs-pager';
import { UploadStatusGateway } from '../gateways/upload-status.gateway';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { UploadCreatedEvent } from '../events/upload-created.event';
import { ArtworkService } from '../../artwork/artwork.service';

@Injectable()
export class UploadService {
    private logger: Logger = new Logger(UploadService.name)

    constructor(
        @Inject(forwardRef(() => SongService)) private songService: SongService,
        private storageService: StorageService,
        private artworkService: ArtworkService,
        private uploadStatusGateway: UploadStatusGateway,
        public uploadRepository: UploadedFileRepository,
        private eventEmitter: EventEmitter2
    ) {}

    /**
     * Find uploaded file by id in database.
     * @param uploadId Id of file
     * @returns UploadedAudioFile
     */
     public async findById(uploadId: string): Promise<UploadedAudioFile> {
        return this.uploadRepository.findOne(uploadId);
    }

    /**
     * Find uploaded file by id in database.
     * @param uploadId Id of file
     * @returns UploadedAudioFile
     */
     public async findByIdWithRelations(uploadId: string): Promise<UploadedAudioFile> {
        return this.uploadRepository.findOne({
            where: { id: uploadId },
            relations: ["uploader", "metadata", "metadata.artists", "metadata.artwork"]
        });
    }

    /**
     * Find page of uploads of specific uploader.
     * @param uploaderId Uploader's id to get page from
     * @param pageable Page settings
     * @returns Page<UploadedAudioFile>
     */
    public async findAllByUploaderId(uploaderId: string, pageable: Pageable): Promise<Page<UploadedAudioFile>> {
        return this.uploadRepository.findAll(pageable, {
            where: {
                uploader: {
                    id: uploaderId
                }
            }
        })
    }

    /**
     * Find page of uploads of specific uploader including all relations.
     * @param uploaderId Uploader's id to get page from
     * @param pageable Page settings
     * @returns Page<UploadedAudioFile>
     */
    public async findAllByUploaderIdWithRelations(uploaderId: string, pageable: Pageable): Promise<Page<UploadedAudioFile>> {
        return this.uploadRepository.findAll(pageable, {
            where: {
                uploader: {
                    id: uploaderId
                }
            },
            relations: ["metadata", "metadata.artists", "metadata.artwork"]
        })
    }

    /**
     * Get file path for upload id.
     * @param uploadId Id to lookup file for
     * @returns 
     */
     public async findPathById(uploadId: string): Promise<string> {
        const uploadedFile: UploadedAudioFile = await this.findById(uploadId);
        if(!uploadedFile) throw new NotFoundException("Media file not found.");

        const filePath = join(UPLOAD_SONGS_DIR, uploadId, `${uploadId}.mp3`);
    
        if(!existsSync(filePath)) throw new NotFoundException("Media file not found");
        return filePath
    }

    /**
     * Check if there already is an entry in database with exact same checksum.
     * If true, there might be a duplicate file upload.
     * @param checksum 
     * @returns 
     */
     public async existsUploadByChecksum(checksum: string): Promise<boolean> {
        return !!(await this.uploadRepository.findOne({ where: { checksum }, select: [ "id" ]}));
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
     * @param tmpPath Path to the file. This file will be deleted on success
     * @returns UploadedAudioFile
     */
    public async createFromFile(tmpPath: string, uploader?: SSOUser, originalName?: string): Promise<UploadedAudioFile> {
        const readableBuffer = tmpPath ? readFileSync(tmpPath) : undefined;
        if(!readableBuffer) throw new InternalServerErrorException("Error reading file.");

        // Check file format
        if(!(await this.storageService.hasSupportedAudioFormat(tmpPath))) throw new BadRequestException("File format not supported.");

        // Create data to be inserted in database
        let uploadedFile = new UploadedAudioFile();
        uploadedFile.sizeInBytes = statSync(tmpPath)?.size || 0;
        uploadedFile.status = uploadedFile.sizeInBytes > 0 ? FileStatus.STATUS_PROCESSING : FileStatus.STATUS_CORRUPTED;
        uploadedFile.uploader = uploader
        uploadedFile.originalName = originalName ? originalName : basename(tmpPath);

        // Create new entry to retrieve resulting id from database.
        uploadedFile = await this.uploadRepository.save(uploadedFile);

        // Create song entry
        const song = await this.songService.createFromFile(tmpPath, uploadedFile.id);
        if(!song) throw new InternalServerErrorException("Could not create metadata from file.")
        uploadedFile.metadata = song;

        // Save relation to database.
        uploadedFile = await this.uploadRepository.save(uploadedFile);

        // Do processing in background. This triggers an event which
        // does some audio encoding in background to optimize streaming
        // experience
        this.eventEmitter.emitAsync("upload.created", new UploadCreatedEvent(uploadedFile.id, tmpPath));

        try {
            // TODO: Separate reindexing from default upload by user?
            // This leads to errors, because reindexing sets uploader to null


            return uploadedFile;
        } catch (error) {
            this.storageService.delete(tmpPath);
            this.delete(uploadedFile.id)
            throw error
        }
    }

    /**
     * Delete uploaded file entry from database.
     * @param id Id of the entry
     * @returns DeleteResult
     */
    public async delete(id: string): Promise<DeleteResult> {
        const uploadedFile = await this.findByIdWithRelations(id);
        if(!uploadedFile) return;
        const deletePath = join(`${UPLOAD_SONGS_DIR}`, id);

        return this.uploadRepository.delete(id).then((result) => {
            this.artworkService.deleteById(uploadedFile.metadata?.artwork?.id)
            this.storageService.delete(deletePath);
            return result;
        });
    }

    /**
     * Convert UploadedAudioFile to mp3 file format. This encodes the file using ffmpeg and deletes tmp file after completion.
     * @param file UploadedAudioFile data
     * @param tmpFilepath Path to tmp file
     * @returns UploadedAudioFile
     */
     public async convertUploadedFileToMp3(file: UploadedAudioFile, tmpFilepath: string): Promise<UploadedAudioFile> {      
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const filepath = tmpFilepath;
                const destFiledir = join(UPLOAD_SONGS_DIR, file.id);
                const destFilepath = join(destFiledir, `${file.id}.mp3`);

                // Create and convert file to mp3
                if(!existsSync(destFiledir)) mkdirSync(destFiledir, { recursive: true });
                try {                    
                    execSync(`${pathToFfmpeg} -i ${filepath} -vn -filter:a loudnorm -filter:a "volume=4" -ac 2 -b:a 192k ${destFilepath}`, { stdio: "pipe" });

                    // Update file status
                    file.status = FileStatus.STATUS_AVAILABLE;

                    if(!existsSync(destFilepath)) {
                        file.sizeInBytes = 0
                        file.status = FileStatus.STATUS_CORRUPTED;
                    } else {
                        file.sizeInBytes = statSync(destFilepath).size
                    }                    
                } catch (error) {
                    this.logger.error(error)

                    // Clean everything up on error
                    this.storageService.delete(destFiledir);

                    file.status = FileStatus.STATUS_CORRUPTED;
                    file.sizeInBytes = 0;
                    reject(error);
                }
                
                resolve(file);
            }, 1000)
        })
    }

    /**
     * Handler for UploadCreatedEvent.
     * This is used to act on newly created uploads and optimizes the uploaded files.
     * @param event Event data
     */
    @OnEvent("upload.created", { async: true })
    public async onUploadCreatedEvent(event: UploadCreatedEvent) {
        const tmpPath = event.filepath;
        const uploadedFile = await this.findByIdWithRelations(event.id);
        if(!uploadedFile) return;

        // Convert file to mp3 in background and update entry in database.
        this.convertUploadedFileToMp3(uploadedFile, tmpPath).then(async (convertedFile: UploadedAudioFile) => {
            const convertedFilepath = join(UPLOAD_SONGS_DIR, convertedFile.id, `${convertedFile.id}.mp3`);
            uploadedFile.checksum = await this.storageService.generateChecksumOfFile(convertedFilepath);

            uploadedFile.sizeInBytes = statSync(convertedFilepath)?.size || 0;
            uploadedFile.status = convertedFile.sizeInBytes > 0 ? FileStatus.STATUS_AVAILABLE : FileStatus.STATUS_CORRUPTED;
            
            // Check if the same file already exists (checksum)
            if(await this.existsUploadByChecksum(uploadedFile.checksum)) uploadedFile.status = FileStatus.STATUS_DUPLICATE;

            // Create artwork from tmp file as the convertedFile does not have any id3tags.
            if(uploadedFile.status == FileStatus.STATUS_AVAILABLE && convertedFile.metadata)  {
                const artwork = await this.artworkService.createArtworkFromAudioFile(tmpPath);
                await this.songService.setArtwork(convertedFile.metadata.id, artwork);
            }

            // Update
            await this.uploadRepository.save(convertedFile)

            if(convertedFile.uploader) {
                this.uploadStatusGateway.sendStatusToUploader(convertedFile)
            }
        }).catch((error) => {
            this.delete(uploadedFile.id)
            this.logger.error(error)

            uploadedFile.status = FileStatus.STATUS_ERRORED
            this.uploadStatusGateway.sendStatusToUploader(uploadedFile)
        }).finally(() => {
            // Cleanup temporary file
            this.storageService.delete(tmpPath);
        })
    }

    public async convertAudioToHls() {
        // TODO: Generate hls files
    }

    /**
     * 
     */
     public async reindexAudioUploads() {
         // TODO: Better reindexing
         // This should not only consider directories but also look for files with no dir
        /*try { 
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
        }*/
    }

}
