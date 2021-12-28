import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SSOUser } from '@tsalliance/sso-nest';
import { DeleteResult, In } from 'typeorm';
import { Mount } from '../bucket/entities/mount.entity';
import { BUCKET_ID } from '../shared/shared.module';
import { SongService } from '../song/song.service';
import { StorageService } from '../storage/storage.service';
import { Index } from './entities/index.entity';
import { IndexStatus } from './enum/index-status.enum';
import { IndexRepository } from './repositories/index.repository';

@Injectable()
export class IndexService {
    private logger: Logger = new Logger(IndexService.name)

    constructor(
        private storageService: StorageService,
        private songService: SongService,
        private indexRepository: IndexRepository,
        @Inject(BUCKET_ID) private bucketId: string
    ){}

    public async findAllByMount(mountId: string): Promise<Index[]> {
        return this.indexRepository.find({ where: { mount: mountId }});
    }

    public async findAllByStatusInBucket(bucketId: string, status: string[]): Promise<Index[]> {
        return this.indexRepository.find({ where: { mount: { bucket: { id: bucketId } }, status: In(status) }, relations: ["mount", "mount.bucket"], select: [ "id", "checksum", "filename", "size", "status", "uploader" ]});
    }

    public async createIndex(mount: Mount, filename: string, uploader?: SSOUser): Promise<Index> {
        const filepath = this.storageService.buildFilepath(mount, filename);
        if(!filepath) throw new InternalServerErrorException("Could not find file.");

        const fileStats = await this.storageService.getFileStats(filepath)
        if(!fileStats) throw new InternalServerErrorException("Could not read file stats.");

        // Create index in database
        const index: Index = await this.indexRepository.save({
            mount,
            filename,
            size: fileStats.size,
            status: IndexStatus.PREPARING,
            uploader
        })

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
                this.songService.createFromIndex(index).then(async (index) => {
                    await this.setStatus(index, index.status)

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

    public async existsByChecksum(checksum: string): Promise<boolean> {
        return !!(await this.indexRepository.findOne({ where: { checksum, status: In([IndexStatus.OK, IndexStatus.PREPARING, IndexStatus.PROCESSING])}}));
    }

    private async setStatus(index: Index, status: IndexStatus): Promise<Index> {
        // TODO: Send index update via websocket
        index.status = status;
        return this.indexRepository.save(index);
    }

    public async clearProcessingOrPreparing(): Promise<DeleteResult> {
        const indices = await this.findAllByStatusInBucket(this.bucketId, [ IndexStatus.PREPARING, IndexStatus.PROCESSING ]);
        return this.indexRepository.delete({ id: In(indices.map((index) => index.id)) });
    }

}
