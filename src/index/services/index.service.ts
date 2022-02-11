import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import sanitize from 'sanitize-filename';
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
import { IndexReportService } from '../../index-report/services/index-report.service';
import { QueueService } from './queue.service';

@Injectable()
export class IndexService {
    private logger: Logger = new Logger(IndexService.name)

    constructor(
        private storageService: StorageService,
        private songService: SongService,
        private indexReportService: IndexReportService,
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
     * Find all indexed files on a certain mount.
     * @param mountId Mount's id
     * @returns Index[]
     */
     public async findPagebyMount(mountId: string, pageable: Pageable): Promise<Page<Index>> {
        const result = await this.indexRepository.createQueryBuilder("index")
            .leftJoin("index.mount", "mount")
            .leftJoinAndSelect("index.report", "report")

            .where("mount.id = :mountId", { mountId })
            .andWhere("index.status NOT IN(:status)", { status: [IndexStatus.PREPARING, IndexStatus.PROCESSING] })
            .getManyAndCount();

        return Page.of(result[0], result[1], pageable?.page);
    }

    /**
     * Find an index by its id.
     * @param indexId Index's id
     * @returns Index
     */
    public async findById(indexId: string): Promise<Index> {
        return this.indexRepository.findOne({ where: { id: indexId }});
    }

    /**
     * Find all indexed files by a certain status inside a whole bucket.
     * @param bucketId Bucket's id
     * @param status Statuses to look for
     * @returns Index[]
     */
    public async findAllByStatusInBucket(bucketId: string, status: string[]): Promise<Index[]> {
        return this.indexRepository.find({ where: { mount: { bucket: { id: bucketId } }, status: In(status) }, relations: ["mount", "mount.bucket"]});
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

    public async findByMountedFileWithRelations(file: MountedFile): Promise<Index> {
        return this.indexRepository.findOne({ where: { filename: sanitize(file.filename), directory: file.directory, mount: { id: file.mount.id }}, relations: ["mount", "song", "uploader"]})
    }

    /**
     * Create index from a file inside a mount.
     * @param mount Mount
     * @param filename Filename in that mount
     * @param uploader User that uploaded the file (optional, only used if this process is triggered by upload)
     * @returns Index
     */
    public async createIndex(file: MountedFile, uploader?: User): Promise<Index> {
        let index = await this.findByMountedFileWithRelations(file);

        if(!index) {
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
            if(!index) {
                index = await this.indexRepository.save({
                    mount: file.mount,
                    filename: sanitize(file.filename),
                    size: fileStats.size,
                    directory: file.directory,
                    uploader
                }).catch(() => {
                    this.logger.error("Could not create new index entry.")
                    return null;
                })
            } else {
                if(uploader) throw new BadRequestException("A similar file already exists.")
            }
        }

        if(!index) throw new BadRequestException("Could not create new index entry.")
        index.status = IndexStatus.PREPARING;

        // Create index report in background (no await)
        this.indexReportService.createBlank(index).then(async (report) => {
            // Connect report with index
            index.report = report;
            this.indexRepository.save(index);
            this.queueService.enqueue(index);
        }).catch(() => {
            // Error occured, continue without a report
            this.indexRepository.save(index);
            this.queueService.enqueue(index);
        });
        
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
        this.queueService.onIndexStart(index)
        await this.indexReportService.appendInfo(index.report, "Started processing...")

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
                    this.setError(index, reason);
                    return index;
                });
            }).catch((reason: Error) => {
                this.setError(index, reason);
                return index;
            })
        }).catch((error: Error) => {
            this.setError(index, error);
            return index;
        })
    }

    public async setError(index: Index, error: Error) {
        this.logger.error(error);

        index.status = IndexStatus.ERRORED;
        this.setStatus(index, IndexStatus.ERRORED);

        this.queueService.onIndexEnded(index, "errored");
        this.indexReportService.appendStackTrace(index.report, `Failed on step 'generateChecksumOfIndex()': ${error.message}`, error.stack);
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
     * Set an index to be ignored. This means that unlike delete, they will still be stored in database,
     * but do not go through indexing processes in the future. So once indexed and set to ignored, they
     * will not be considered on any indexing processes anymore.
     * @param indexId Index's id
     * @returns Index
     */
    public async setIgnored(indexId: string): Promise<Index> {
        const index = await this.findById(indexId);
        if(!index) throw new NotFoundException("Index not found.")

        index.status = IndexStatus.IGNORE;
        return this.indexRepository.save(index);
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
