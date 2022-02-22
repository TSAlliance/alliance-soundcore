import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
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
import { sleep } from '../../utils/sleep';

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
        return this.findIndex({ id: indexId });
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
        return this.indexRepository.findOne({ where: { filename: file.filename, directory: file.directory, mount: { id: file.mount.id }}, relations: ["mount", "song", "uploader"]})
    }

    public async createForFiles(mountedFiles: MountedFile[], uploader?: User): Promise<Index[]> {
        const sublists: MountedFile[][] = [];
        const maxIndex = mountedFiles.length

        for(let i = 0; ; i += 500) {
            const offset = i == 0 ? i : i + 1;
            const limit = i + 500;

            if(limit >= maxIndex) {
                sublists.push(mountedFiles.slice(offset, maxIndex));
                break;
            } else {
                sublists.push(mountedFiles.slice(offset, limit));
            }
        }

        const indices: Index[] = [];
        for(const list of sublists) {
            await sleep(2000);

            let files = list;
            if(!files || files.length <= 0) return [];
            
            const indicesWithoutReport: Index[] = [];

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
                    const index: Index = indexedFiles[identifier];
                    
                    // Check if identifier exists.
                    // If so, return false and add existing index to indices array
                    if(!!index) {
                        indices.push(indexedFiles[identifier])
                        if(!index.report) indicesWithoutReport.push(index);
                        return false;
                    }

                    // Does not exist, return true to create index in next step
                    return true;
                })
            }

            const createIndices: Index[] = [];
            // Create index for non-indexed files
            for(const file of files) {

                const index = new Index();
                index.filename = file.filename;
                index.mount = file.mount,
                index.uploader = uploader;
                index.status = IndexStatus.PREPARING;
                index.directory = file.directory;

                // Check if path exists
                const filepath = this.storageService.buildFilepathNonIndex(file);
                if(!filepath) {
                    if(uploader) throw new InternalServerErrorException("Could not find file.");
                    console.error("Could not find file.")
                    index.status = IndexStatus.ERRORED_PATH;
                }

                // Get file stats (especially used for fileSize)
                const fileStats = await this.storageService.getFileStats(filepath).catch((error) => {
                    console.error(error)
                    return null;
                })

                if(!fileStats) {
                    if(uploader) throw new InternalServerErrorException("Could not read file stats.");
                    console.error("Could not read file stats.")
                    index.status = IndexStatus.ERRORED_PATH;
                }

                // Set file size
                index.size = fileStats?.size || 0;
                createIndices.push(index);
            }

            // Save indices to database
            const results = await this.indexRepository.save(createIndices).catch((reason) => {
                console.error(reason);
                return [];
            })

            // Create reports for indices
            const reports = await this.indexReportService.createMultiple(results).catch((reason) => {
                console.error(reason)
                return [];
            });

            results.map((result: Index) => {
                result.report = reports.find((report: IndexReport) => report.index.id == result.id)
            })

            indices.push(...results)
        }

        // Enqueue indices
        this.queueService.enqueueMultiple(indices);
        return indices
        
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
            index = await this.createForFiles([file], uploader).then((result) => result[0]).catch((error) => {
                console.error(error)
                throw new InternalServerErrorException(error.message);
            });
        }

        if(!index) throw new BadRequestException("Could not create new index entry.")
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
        console.log("processing index...")
        if(!index.report) {
            index.report = await this.indexReportService.createBlank(index).catch(() => null);
        }

        if(index.status == IndexStatus.ERRORED || index.status == IndexStatus.ERRORED_PATH) {
            this.setStatus(index, index.status);
            this.queueService.onIndexEnded(index, "errored");
            console.log("index errored before processing started.")
            this.indexReportService.appendError(index.report, "Index errored before processing started.")
            return index;
        }

        this.queueService.onIndexStart(index)
        await this.indexReportService.appendInfo(index.report, "Started processing...")

        // Do indexing tasks in background
        console.log("generating checksum")
        return this.storageService.generateChecksumOfIndex(index).then(async (index) => {
            this.setStatus(index, index.status);
            if(index.status == IndexStatus.ERRORED) {
                await this.indexReportService.appendError(index.report, `Failed calculating checksum of file.`);
                this.queueService.onIndexEnded(index, "errored");
                console.log("could not generate checksum")
                return index;
            }

            console.log("checking for duplicate based on checksum")
            // Check for duplicate files and abort if so
            if(await this.existsByChecksum(index.checksum, index.id)) {
                this.setStatus(index, IndexStatus.DUPLICATE);
                await this.indexReportService.appendError(index.report, `Found two files with same checksum. It seems like the file already exists.`);
                this.queueService.onIndexEnded(index, "errored");
                console.log("file exists")
                return index;
            }


            // Continue with next step: Create optimized mp3 files
            console.log("creating optimized file (does nothing in current build)")
            this.storageService.createOptimizedMp3File(index).then(async (index) => {
                index = await this.setStatus(index, index.status)
                if(index.status == IndexStatus.ERRORED){
                    this.queueService.onIndexEnded(index, "errored");
                    console.log("failed creating optimized file")
                    return;
                }

                console.log("Creating song from index...")
                // Continue with next step: Create song metadata from index
                this.songService.createFromIndex(index).then(async (song) => {
                    console.log("createFromIndex(): done.")
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
}
