import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { DeleteResult, In } from 'typeorm';
import { Mount } from '../../bucket/entities/mount.entity';
import { BUCKET_ID } from '../../shared/shared.module';
import { SongService } from '../../song/song.service';
import { StorageService } from '../../storage/storage.service';
import { User } from '../../user/entities/user.entity';
import { Index } from '../entities/index.entity';
import { IndexStatus } from '../enum/index-status.enum';
import { IndexGateway } from '../gateway/index.gateway';
import { IndexRepository } from '../repositories/index.repository';

@Injectable()
export class IndexService {
    private logger: Logger = new Logger(IndexService.name)

    constructor(
        private storageService: StorageService,
        private songService: SongService,
        private indexRepository: IndexRepository,
        private indexGateway: IndexGateway,
        @Inject(BUCKET_ID) private bucketId: string
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
    public async createIndex(mount: Mount, filename: string, uploader?: User): Promise<Index> {
        // TODO: Check if filename together with mount exists as index and has status ERRORED
        // Errored Indexes should be triggered to reindex manually
        const filepath = this.storageService.buildFilepath(mount, filename);
        if(!filepath) throw new InternalServerErrorException("Could not find file.");

        const fileStats = await this.storageService.getFileStats(filepath)
        if(!fileStats) throw new InternalServerErrorException("Could not read file stats.");

        // Create index in database or fetch existing
        let index = await this.findByMountAndFilenameWithRelations(mount.id, filename);
        if(!index) {
            index = await this.indexRepository.save({
                mount,
                filename,
                size: fileStats.size,
                status: IndexStatus.PREPARING,
                uploader
            })
        }

        // TODO: Implement index queue to only have one file at a time be indexed.
        // This slows down indexing process, but prevents duplication errors on album / artists and so on

        // Do indexing tasks in background
        this.storageService.generateChecksumOfIndex(index).then(async (index) => {
            this.setStatus(index, index.status);
            if(index.status == IndexStatus.ERRORED) return;

            // Check for duplicate files and abort if so
            if(await this.existsByChecksum(index.checksum)) {
                this.setStatus(index, IndexStatus.DUPLICATE);
                return;
            }

            // Continue with next step: Create optimized mp3 files
            this.storageService.createOptimizedMp3File(index).then(async (index) => {
                index = await this.setStatus(index, index.status)
                if(index.status == IndexStatus.ERRORED) return;

                // Continue with next step: Create song metadata from index
                this.songService.createFromIndex(index).then(async (song) => {
                    await this.setStatus(song.index, song.index.status)

                    // Done at this point. The createFromIndex() in song service handles all required
                    // steps to gather information like artists, album and cover artwork
                });
            })
        }).catch((error) => {
            this.logger.error(error);

            index.status = IndexStatus.ERRORED;
            this.setStatus(index, IndexStatus.ERRORED);
        })

        // Return index object.
        return index;
    }

    /**
     * Check if a file exists identified by a checksum.
     * This has a low probablity of files matching, that are actually not the same.
     * (But its very unlikely)
     * @param checksum Checksum to check
     * @returns True or False
     */
    public async existsByChecksum(checksum: string): Promise<boolean> {
        return !!(await this.indexRepository.findOne({ where: { checksum, status: In([IndexStatus.OK, IndexStatus.PREPARING, IndexStatus.PROCESSING])}}));
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
    public async clearProcessingOrPreparing(): Promise<DeleteResult> {
        const indices = await this.findAllByStatusInBucket(this.bucketId, [ IndexStatus.PREPARING, IndexStatus.PROCESSING ]);
        return this.indexRepository.delete({ id: In(indices.map((index) => index.id)) });
    }

}
