import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SSOUser } from '@tsalliance/sso-nest';
import { Mount } from '../bucket/entities/mount.entity';
import { StorageService } from '../storage/storage.service';
import { Index } from './entities/index.entity';
import { IndexStatus } from './enum/index-status.enum';
import { IndexRepository } from './repositories/index.repository';

@Injectable()
export class IndexService {

    constructor(
        private storageService: StorageService,
        private indexRepository: IndexRepository
    ){}

    public async createIndex(mount: Mount, filename: string, uploader?: SSOUser): Promise<Index> {
        const filepath = this.storageService.buildFilepath(mount, filename);
        if(!filepath) throw new InternalServerErrorException("Could not find file.");

        const fileStats = await this.storageService.getFileStats(filepath)
        if(!fileStats) throw new InternalServerErrorException("Could not read file stats.");

        // Create index in database
        const index = await this.indexRepository.save({
            mount,
            filename,
            size: fileStats.size,
            status: IndexStatus.PREPARING,
            uploader
        })

        // Do indexing tasks in background
        this.storageService.createOptimizedMp3File(index).then((index) => {
            // TODO: Send index update via websocket
            this.indexRepository.save(index);
            
        })

        // Return index object.
        return index;
    }

}
