import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { In } from 'typeorm';
import { MountedFile } from '../../bucket/entities/mounted-file.entity';
import { BUCKET_ID } from '../../shared/shared.module';
import { SongService } from '../../song/song.service';
import { StorageService } from '../../storage/storage.service';
import { User } from '../../user/entities/user.entity';
import { Index } from '../entities/index.entity';
import { IndexStatus } from '../enum/index-status.enum';
import { IndexGateway } from '../gateway/index.gateway';
import { IndexRepository } from '../repositories/index.repository';
import { QueueService } from './queue.service';

@Injectable()
export class IndexService {
    private logger: Logger = new Logger(IndexService.name)

    constructor(
        private storageService: StorageService,
        private songService: SongService,
        private indexRepository: IndexRepository,
        private indexGateway: IndexGateway,
        @Inject(BUCKET_ID) private bucketId: string,
        @Inject(forwardRef(() => QueueService)) private queueService: QueueService
    ){}

    /**
     * Find all indexed files on a certain mount.
     * @param mountId Mount's id
     * @returns Index[]
     */
    public async findAllByMount(mountId: string): Promise<Index[]> {
        return this.indexRepository.find({ where: { mount: mountId }});
    }

    /**
     * Find all indexed files by a certain status inside a whole bucket.
     * @param bucketId Bucket's id
     * @param status Statuses to look for
     * @returns Index[]
     */
    public async findAllByStatusInBucket(bucketId: string, status: string[]): Promise<Index[]> {
        return this.indexRepository.find({ where: { mount: { bucket: { id: bucketId } }, status: In(status) }, relations: ["mount", "mount.bucket"], select: [ "id", "checksum", "filename", "size", "status", "uploader" ]});
    }

    /**
     * Find page of indexed files by a certain uploader.
     * @param uploaderId Uploader's id
     * @param pageable Page settings
     * @returns Page<Index>
     */
    public async findPageByUploader(uploaderId: string, pageable: Pageable): Promise<Page<Index>> {
        return this.indexRepository.findAll(pageable, { where: { uploader: { id: uploaderId}}, relations: ["song", "song.artists", "song.artwork"]})
    }

    public async findByMountAndFilenameWithRelations(mountId: string, filename: string): Promise<Index> {
        return this.indexRepository.findOne({ where: { filename, mount: { id: mountId }}, relations: ["mount", "song", "uploader"]})
    }

    /**
     * Create index from a file inside a mount.
     * @param mount Mount
     * @param filename Filename in that mount
     * @param uploader User that uploaded the file (optional, only used if this process is triggered by upload)
     * @returns Index
     */
    public async createIndex(file: MountedFile, uploader?: User): Promise<Index> {
        const filepath = this.storageService.buildFilepathNonIndex(file);
        if(!filepath) {
            if(uploader) throw new InternalServerErrorException("Could not find file.");
            return null;
        }

        const fileStats = await this.storageService.getFileStats(filepath)
        if(!fileStats) {
            if(uploader) throw new InternalServerErrorException("Could not read file stats.");
            return null;
        }

        // Create index in database or fetch existing
        let index = await this.findByMountAndFilenameWithRelations(file.mount.id, file.filename);
        if(!index) {
            index = await this.indexRepository.save({
                mount: file.mount,
                filename: file.filename,
                size: fileStats.size,
                directory: file.directory,
                uploader
            })
        } else {
            if(uploader) throw new BadRequestException("A similar file already exists.")
        }

        index.status = IndexStatus.PREPARING;
        await this.indexRepository.save(index);
        await this.queueService.enqueue(index);
        return index;
    }

    /**
     * Create index from a file inside a mount.
     * @param mount Mount
     * @param filename Filename in that mount
     * @param uploader User that uploaded the file (optional, only used if this process is triggered by upload)
     * @returns Index
     */
    public async processIndex(index: Index): Promise<Index> {
        // TODO: Implement index queue to only have one file at a time be indexed.
        // This slows down indexing process, but prevents duplication errors on album / artists and so on
        this.queueService.onIndexStart(index)

        // Do indexing tasks in background
        return this.storageService.generateChecksumOfIndex(index).then(async (index) => {
            this.setStatus(index, index.status);
            if(index.status == IndexStatus.ERRORED) {
                this.queueService.onIndexEnded(index, "errored");
                return index;
            }

            // Check for duplicate files and abort if so
            if(await this.existsByChecksum(index.checksum)) {
                this.setStatus(index, IndexStatus.DUPLICATE);
                this.queueService.onIndexEnded(index, "errored");
                return index;
            }

            // Continue with next step: Create optimized mp3 files
            this.storageService.createOptimizedMp3File(index).then(async (index) => {
                index = await this.setStatus(index, index.status)
                if(index.status == IndexStatus.ERRORED){
                    this.queueService.onIndexEnded(index, "errored");
                    return;
                }

                // Continue with next step: Create song metadata from index
                this.songService.createFromIndex(index).then(async (song) => {
                    index = await this.setStatus(song.index, song.index.status)

                    // Done at this point. The createFromIndex() in song service handles all required
                    // steps to gather information like artists, album and cover artwork
                    this.queueService.onIndexEnded(index, "done");
                    return index;
                }).catch((reason) => {
                    this.logger.error(reason)
    
                    index.status = IndexStatus.ERRORED;
                    this.setStatus(index, IndexStatus.ERRORED);
    
                    this.queueService.onIndexEnded(index, "errored");
                    return index;
                });
            }).catch((reason) => {
                this.logger.error(reason)

                index.status = IndexStatus.ERRORED;
                this.setStatus(index, IndexStatus.ERRORED);

                this.queueService.onIndexEnded(index, "errored");
                return index;
            })
        }).catch((error) => {
            this.logger.error(error);

            index.status = IndexStatus.ERRORED;
            this.setStatus(index, IndexStatus.ERRORED);

            this.queueService.onIndexEnded(index, "errored");
            return index;
        })
    }

    /**
     * Check if a file exists identified by a checksum.
     * This has a low probablity of files matching, that are actually not the same.
     * (But its very unlikely)
     * @param checksum Checksum to check
     * @returns True or False
     */
    public async existsByChecksum(checksum: string): Promise<boolean> {
        return !!(await this.indexRepository.findOne({ where: { checksum, status: In([IndexStatus.OK, IndexStatus.PROCESSING])}}));
    }

    /**
     * Update indexing status for an indexed file.
     * @param index Indexed file to update
     * @param status Updated status
     * @returns Index
     */
    private async setStatus(index: Index, status: IndexStatus): Promise<Index> {
        index.status = status;
        this.indexGateway.sendUpdateToUploader(index)
        return this.indexRepository.save(index);
    }

    /**
     * Clear all indexed files, that may be stuck in PROCESSING or PREPARING status.
     * This should only be called on the application startup. This only clears indexed files
     * inside bucket of the current machine.
     * @returns DeleteResult
     */
    public async clearOrResumeProcessing(): Promise<void> {
        const indices = await this.findAllByStatusInBucket(this.bucketId, [ IndexStatus.PROCESSING, IndexStatus.PREPARING ]);

        const preparing = [];
        const processing = [];

        indices.forEach((i) => {
            if(i.status == IndexStatus.PREPARING) preparing.push(i)
            else processing.push(i)
        })

        for(const index of preparing) {
            await this.queueService.enqueue(index);
        }
        
        await this.indexRepository.delete({ id: In(processing.map((index) => index.id)) });
    }
}
