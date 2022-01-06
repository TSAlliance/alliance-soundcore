import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ArtworkService } from '../artwork/artwork.service';
import { MOUNT_ID } from '../shared/shared.module';
import { CreatePublisherDTO } from './dtos/create-publisher.dto';
import { Publisher } from './entities/publisher.entity';
import { PublisherRepository } from './repositories/publisher.repository';

@Injectable()
export class PublisherService {

    constructor(
        private artworkService: ArtworkService,
        private publisherRepository: PublisherRepository,
        @Inject(MOUNT_ID) private mountId: string
    ){}

    /**
     * Create new publisher by name if it does not already exist in the database.
     * @param createPublisherDto Publisher data to create
     * @returns Publisher
     */
    public async createIfNotExists(createPublisherDto: CreatePublisherDTO): Promise<Publisher> {
        const publisher: Publisher = await this.publisherRepository.findOne({ where: { name: createPublisherDto.name }})
        if(publisher) return publisher;

        const publisherResult = await this.publisherRepository.save({
            name: createPublisherDto.name,
            geniusId: createPublisherDto.geniusId
        })

        if(!publisherResult) throw new InternalServerErrorException("Could not create publisher.")

        if(createPublisherDto.externalImgUrl) {
            const artwork = await this.artworkService.create({ 
                type: "publisher",
                url: createPublisherDto.externalImgUrl,
                autoDownload: true,
                mountId: createPublisherDto.artworkMountId || this.mountId
            })
            if(artwork) publisherResult.artwork = artwork
        }

        return this.publisherRepository.save(publisherResult)
    }

}
