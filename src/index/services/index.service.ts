import { Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { FindConditions, In, Not, ObjectLiteral } from 'typeorm';
import { MountedFile } from '../../bucket/entities/mounted-file.entity';
import { BUCKET_ID } from '../../shared/shared.module';
import { StorageService } from '../../storage/storage.service';
import { User } from '../../user/entities/user.entity';
import { Index, IndexRawPath } from '../entities/index.entity';
import { IndexStatus } from '../enum/index-status.enum';
import { IndexGateway } from '../gateway/index.gateway';
import { IndexRepository } from '../repositories/index.repository';
import { IndexReportService } from '../../index-report/services/index-report.service';
import { IndexReport } from '../../index-report/entities/report.entity';
import { sleep } from '../../utils/sleep';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class IndexService {
    private logger: Logger = new Logger(IndexService.name)

    constructor(
        private storageService: StorageService,
        private indexReportService: IndexReportService,
        private indexRepository: IndexRepository,
        private indexGateway: IndexGateway,
        @InjectQueue("index-queue") public indexQueue: Queue<MountedFile>,
        @Inject(BUCKET_ID) private bucketId: string,
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
     public async findByMountId(mountId: string, pageable: Pageable): Promise<Page<Index>> {
        const result = await this.indexRepository.createQueryBuilder("index")
            .leftJoin("index.mount", "mount")
            .leftJoinAndSelect("index.uploader", "uploader")

            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable?.size || 30)

            .addSelect(["mount.path"])
            .where("mount.id = :mountId", { mountId })
            .andWhere("index.status != :status", { status: IndexStatus.IGNORE.toString() })

            .orderBy("index.indexedAt", "DESC")
            .getManyAndCount();

        return Page.of(result[0], result[1], pageable?.page);
    }

    /**
     * Find an index by its id.
     * @param indexId Index's id
     * @returns Index
     */
    public async findById(indexId: string): Promise<Index> {
        return this.indexRepository.findOne({ where: { id: indexId }})
    }

    public async findIndex(where: string | ObjectLiteral | FindConditions<Index> | FindConditions<Index>[]): Promise<Index> {
        return (await this.findMultipleIndices(where))[0];
    }

    public async findMultipleIndices(where: string | ObjectLiteral | FindConditions<Index> | FindConditions<Index>[]): Promise<Index[]> {
        // TODO: Possible this could result in cyclic dependency?! Because of song.index relation
        return this.indexRepository.find({ where, relations: ["mount", "mount.bucket", "report", "uploader", "song", "song.index", "song.albums", "song.artists", "song.artwork", "song.banner", "song.label", "song.albumOrders", "song.distributor", "song.publisher", "song.genres"]})
    }

    /**
     * Find page of indexed files by a certain uploader.
     * @param uploaderId Uploader's id
     * @param pageable Page settings
     * @returns Page<Index>
     */
    public async findPageByUploader(uploaderId: string, pageable: Pageable): Promise<Page<Index>> {
        return this.indexRepository.findAll(pageable, { where: { uploader: { id: uploaderId }, status: Not(IndexStatus.IGNORE)}, relations: ["song", "song.artists", "song.artwork"]})
    }

    public async findByMountedFileWithRelations(file: MountedFile): Promise<Index> {
        return this.findIndex({ name: file.filename, directory: file.directory, mount: { id: file.mount?.id }})
    }

    public async findByMountedFile(file: MountedFile): Promise<Index> {
        return this.indexRepository.findOne({ name: file.filename, directory: file.directory, mount: { id: file.mount.id }})
    }







    public async findRawPathsByMount(mountId: string): Promise<IndexRawPath[]> {
        const result = await this.indexRepository.createQueryBuilder("index")
            .leftJoin("index.mount", "mount")
            .where("mount.id = :mountId", { mountId })
            .select(["index.filename", "index.directory", "mount.id"])
            .getRawMany()

        return result;
    }











    public async findIdsByMountedFiles(files: MountedFile[]): Promise<Index[]> {
        const dirs: string[] = [];
        const filenames: string[] = [];
        const mounts: string[] = [];

        const length = files.length;
        let x = 0;

        while(x < length) {
            dirs.push(files[x].directory);
            filenames.push(files[x].filename || ".");
            mounts.push(files[x].mount.id);
            x++;
        }

        const status = Object.values(IndexStatus).filter((status) => status != IndexStatus.PREPARING && status != IndexStatus.PROCESSING)
        return this.indexRepository.find({ where: { name: In(filenames), directory: In(dirs), mount: { id: In(mounts), status: In(status) }}, select: ["id", "directory", "name"]})
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

            const existingIndices = await this.findMultipleIndices({ directory: In(files.map((file) => file.directory)), name: In(In(files.map((file) => file.filename))), mount: { id: In(In(files.map((file) => file.mount?.id)))} })
            if(existingIndices.length > 0) {
                const indexedFiles: Map<string, Index> = new Map();

                // Map existing indices to mounted file
                for(const index of existingIndices) {
                    // Generate unique identifier by appending all strings
                    const identifier = index.directory + index.name + index.mount.id;
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
                index.name = file.filename;
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

        return indices
    }

    /**
     * Create index from a file inside a mount.
     * @param mount Mount
     * @param filename Filename in that mount
     * @param uploader User that uploaded the file (optional, only used if this process is triggered by upload)
     * @returns Index
     */
    public async createIndexIfNotExists(file: MountedFile, uploader?: User): Promise<Index> {
        let index = await this.findByMountedFileWithRelations(file);

        if(!index) {
            index = await this.createForFiles([file], uploader).then((result) => result[0]).catch((error) => {
                console.error(error)
                throw new InternalServerErrorException(error.message);
            });
        }

        return index;
    }

    public async reindex(indexId: string) {
        const index = await this.findIndex({ id: indexId })
        if(!index) throw new NotFoundException("Index not found");

        index.status = IndexStatus.PREPARING;
        return this.indexRepository.save(index).then((index) => {
            const file = new MountedFile(index.directory, index.name, index.mount);
            return this.indexQueue.add(file, { jobId: file.bullJobId }).then(() => {
                return true;
            })
        })
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

    public async deleteById(indexId: string): Promise<Index> {
        return this.setIgnored(indexId);
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
    public async updateIndex(index: Index): Promise<Index> {
        this.indexGateway.broadcastUpdate(index)
        return this.indexRepository.save(index);
    }

    /**
     * Execute search query for a song. This looks up songs that match the query.
     * The search includes looking for songs with a specific artist's name.
     * @param query Query string
     * @param pageable Page settings
     * @returns Page<Song>
     */
     public async findBySearchQueryInMount(query: string, mountId: string, pageable: Pageable): Promise<Page<Index>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        // Find song by title or if the artist has similar name
        const result = this.indexRepository.createQueryBuilder("index")
            .leftJoin("index.song", "song")
            .leftJoin("song.artists", "artist")
            .leftJoin("index.mount", "mount")
            .leftJoin("index.report", "report")
            .leftJoinAndSelect("index.uploader", "uploader")
            .leftJoinAndSelect("song.artwork", "song")

            .addSelect(["song.id", "song.title", "song.slug", "report.id", "artist.id", "artist.name", "artist.slug"])

            .where("index.filename LIKE :query", { query })
            .orWhere("song.title LIKE :query", { query })
            .andWhere("mount.id = :mountId", { mountId })

            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)
            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }
}
