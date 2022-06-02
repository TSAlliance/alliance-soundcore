import { Inject, Injectable, Logger } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { ArtworkService } from '../artwork/artwork.service';
import { MOUNT_ID } from '../shared/shared.module';
import { CreatePublisherDTO } from './dtos/create-publisher.dto';
import { Publisher } from './entities/publisher.entity';
import { PublisherRepository } from './repositories/publisher.repository';

@Injectable()
export class PublisherService {
    private logger: Logger = new Logger(PublisherService.name)

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
        let publisher: Publisher = await this.publisherRepository.findOne({ where: { name: createPublisherDto.name }})
        if(publisher) return publisher;

        publisher = new Publisher();
        publisher.name = createPublisherDto.name;
        publisher.geniusId = createPublisherDto.geniusId;
        publisher = await this.publisherRepository.save(publisher)

        if(!publisher) {
            this.logger.error("Could not create publisher.")
            return null;
        }

        if(createPublisherDto.externalImgUrl) {
            // const artwork = await this.artworkService.create({ 
            //     type: "publisher",
            //     url: createPublisherDto.externalImgUrl,
            //     autoDownload: true,
            //     dstFilename: publisher.name,
            //     mountId: createPublisherDto.artworkMountId || this.mountId
            // })
            // if(artwork) publisher.artwork = artwork
        }

        return this.publisherRepository.save(publisher)
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Publisher>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        return this.publisherRepository.findAll(pageable, { where: { name: ILike(query) }, relations: ["artwork"]})
    }

}
