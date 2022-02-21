import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import sanitize from 'sanitize-filename';
import { FindConditions, In, Not, ObjectLiteral } from 'typeorm';
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
import { IndexReport } from '../../index-report/entities/report.entity';

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
        return this.findMultipleIndices({ mount: mountId });
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

    public async findIndex(where: string | ObjectLiteral | FindConditions<Index> | FindConditions<Index>[]): Promise<Index> {
        return this.findMultipleIndices(where)[0];
    }
    public async findMultipleIndices(where: string | ObjectLiteral | FindConditions<Index> | FindConditions<Index>[]): Promise<Index[]> {
        return this.indexRepository.find({ where, relations: ["mount", "mount.bucket", "report", "uploader", "song", "song.albums", "song.artists", "song.artwork", "song.banner", "song.label", "song.albumOrders", "song.distributor", "song.publisher", "song.genres"]})
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

    public async createForFiles(files: MountedFile[], uploader?: User): Promise<[Index[], IndexReport[]]> {
        const indices: Index[] = [];
        const reports: IndexReport[] = [];

        // Sanatize all filenames 
        // to fit os conventions
        files = files.map((file) => {
            file.filename = sanitize(file.filename);
            return file;
        })

        // Check if file already exists as index

        const existingIndices = await this.findMultipleIndices({ directory: In(files.map((file) => file.directory)), filename: In(In(files.map((file) => file.filename))), mount: { id: In(In(files.map((file) => file.mount.id)))} })
        if(existingIndices.length > 0) {
            const indexedFiles: Map<string, Index> = new Map();

            // Map existing indices to mounted file
            for(const index of existingIndices) {
                // Generate unique identifier by appending all strings
                const identifier = index.directory + index.filename + index.mount.id;
                indexedFiles[identifier] = index;
            }

            // Filter files array and exclude existing ones.
            files = files.filter((file) => {
                // Generate unique identifier by appending all strings
                const identifier = file.directory + file.filename + file.mount.id;
                
                // Check if identifier exists.
                // If so, return false and add existing index to indices array
                if(!!indexedFiles[identifier]) {
                    indices.push(indexedFiles[identifier])
                    return false;
                }

                // Does not exist, return true to create index in next step
                return true;
            })
        }

        // Create index for non-indexed files
        for(const file of files) {
            // Check if path exists
            const filepath = this.storageService.buildFilepathNonIndex(file);
            if(!filepath) throw new InternalServerErrorException("Could not find file.");

            // Get file stats (especially used for fileSize)
            const fileStats = await this.storageService.getFileStats(filepath)
            if(!fileStats) throw new InternalServerErrorException("Could not read file stats.");

            // Create new index for file
            const index = new Index();
            index.filename = file.filename;
            index.mount = file.mount,
            index.size = fileStats.size;
            index.directory = file.directory;
            index.uploader = uploader;
            index.status = IndexStatus.PREPARING;

            // Create report
            const report = new IndexReport();
            report.jsonContents = [
                { timestamp: Date.now(), status: "info", message: `Report created for index '${index.id}'.` }
            ]
            reports.push(report);

            // Bind report to index
            index.report = report;
            indices.push(index);
        }

        const results = await this.indexRepository.save(indices).catch((reason) => {
            console.error(reason)
            return []
        })

        this.queueService.enqueueMultiple(results);

        return [await this.indexRepository.save(indices).catch(() => []), reports]
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
            index = await this.createForFiles([file], uploader)[0][0];
        }

        if(!index) throw new BadRequestException("Could not create new index entry.")
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
        this.queueService.onIndexStart(index)
        await this.indexReportService.appendInfo(index.report, "Started processing...")

        // Do indexing tasks in background
        return this.storageService.generateChecksumOfIndex(index).then(async (index) => {
            this.setStatus(index, index.status);
            if(index.status == IndexStatus.ERRORED) {
                await this.indexReportService.appendError(index.report, `Failed calculating checksum of file.`);
                this.queueService.onIndexEnded(index, "errored");
                console.log("could not generate checksum")
                return index;
            }

            // Check for duplicate files and abort if so
            if(await this.existsByChecksum(index.checksum, index.id)) {
                this.setStatus(index, IndexStatus.DUPLICATE);
                await this.indexReportService.appendError(index.report, `Found two files with same checksum. It seems like the file already exists.`);
                this.queueService.onIndexEnded(index, "errored");
                console.log("file exists")
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
        this.indexReportService.appendStackTrace(index.report, `Failed: ${error.message}`, error.stack);
    }

    /**
     * Check if a file exists identified by a checksum.
     * This has a low probablity of files matching, that are actually not the same.
     * (But its very unlikely)
     * @param checksum Checksum to check
     * @returns True or False
     */
    public async existsByChecksum(checksum: string, indexId: string): Promise<boolean> {
        return !!(await this.indexRepository.findOne({ where: { checksum, id: Not(indexId), status: In([IndexStatus.OK, IndexStatus.PROCESSING])}}));
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
        const indices = await this.findMultipleIndices({ mount: { bucket: { id: this.bucketId }}, status: In([ IndexStatus.PROCESSING, IndexStatus.PREPARING ])});
        await this.queueService.enqueueMultiple(indices);
    }
}
