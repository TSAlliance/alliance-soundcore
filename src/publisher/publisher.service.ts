import { Injectable } from '@nestjs/common';
import { Publisher } from './entities/publisher.entity';
import { PublisherRepository } from './repositories/publisher.repository';

@Injectable()
export class PublisherService {

    constructor(private publisherRepository: PublisherRepository){}

    /**
     * Create new publisher by name if it does not already exist in the database.
     * @param name Name of the publisher
     * @param geniusId Id to the GENIUS entry (handled by genius as "artist") (optional)
     * @returns Publisher
     */
    public async createIfNotExists(name: string, geniusId?: string): Promise<Publisher> {
        const publisher: Publisher = await this.publisherRepository.findOne({ where: { name }})
        if(publisher) return publisher;

        return this.publisherRepository.save({
            name,
            geniusId
        })
    }

}
