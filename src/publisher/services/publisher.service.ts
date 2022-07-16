import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Page, Pageable } from 'nestjs-pager';
import { DeleteResult, ILike, Repository } from 'typeorm';
import { Artwork } from '../../artwork/entities/artwork.entity';
import { RedlockError } from '../../exceptions/redlock.exception';
import { CreateResult } from '../../utils/results/creation.result';
import { RedisLockableService } from '../../utils/services/redis-lockable.service';
import { CreatePublisherDTO } from '../dtos/create-publisher.dto';
import { UpdatePublisherDTO } from '../dtos/update-publisher.dto';
import { Publisher } from '../entities/publisher.entity';

@Injectable()
export class PublisherService extends RedisLockableService {
    private readonly logger: Logger = new Logger(PublisherService.name)

    constructor(
        @InjectRepository(Publisher) private readonly repository: Repository<Publisher>
    ){
        super();
    }

    /**
     * Find a publisher by its id.
     * @param publisherId Publisher's id
     * @returns Publisher
     */
     public async findById(publisherId: string): Promise<Publisher> {
        return this.repository.createQueryBuilder("publisher")
            .leftJoin("publisher.artwork", "artwork")
            .addSelect(["artwork.id"])
            .where("publisher.id = :publisherId", { publisherId })
            .getOne();
    }

    /**
     * Find a publisher by its name.
     * @param name Publisher's name
     * @returns Publisher
     */
    public async findByName(name: string): Promise<Publisher> {
        return this.repository.createQueryBuilder("publisher")
            .leftJoin("publisher.artwork", "artwork")
            .addSelect(["artwork.id"])
            .where("publisher.name = :name", { name })
            .getOne();
    }

    /**
     * Create new publisher by name if it does not already exist in the database.
     * @param createPublisherDto Publisher data to create
     * @returns Publisher
     */
    public async createIfNotExists(createPublisherDto: CreatePublisherDTO, waitForLock = false): Promise<CreateResult<Publisher>> {
        createPublisherDto.name = createPublisherDto.name?.replace(/^[ ]+|[ ]+$/g,'')?.trim();
        createPublisherDto.description = createPublisherDto.description?.trim();

        // Acquire lock
        return this.lock(createPublisherDto.name, async (signal) => {
            // Check if publisher exists
            const existingPublisher = await this.findByName(createPublisherDto.name);
            if(existingPublisher) return new CreateResult(existingPublisher, true); 
            if(signal.aborted) throw new RedlockError();

            const publisher = new Publisher();
            publisher.name = createPublisherDto.name;
            publisher.geniusId = createPublisherDto.geniusId;
            publisher.description = createPublisherDto.description;

            return this.repository.save(publisher).then((result) => {
                return new CreateResult(result, false);
            });
        }, waitForLock).catch((error: Error) => {
            this.logger.error(`Failed creating publisher: ${error.message}`, error.stack);
            throw new InternalServerErrorException();
        });
    }

    /**
     * Update a publisher.
     * @param publisherId Publisher's id
     * @param updateLabelDto Updated data.
     * @returns Publisher
     */
    public async update(publisherId: string, updatePublisherDto: UpdatePublisherDTO): Promise<Publisher> {
        updatePublisherDto.name = updatePublisherDto.name?.replace(/^[ ]+|[ ]+$/g,'')?.trim();
        updatePublisherDto.description = updatePublisherDto.description?.trim();

        const publisher = await this.findById(publisherId);
        if(!publisher) throw new NotFoundException("Publisher not found.");

        publisher.name = updatePublisherDto.name;
        publisher.geniusId = updatePublisherDto.geniusId;
        publisher.description = updatePublisherDto.description;

        return this.repository.save(publisher);
    }

    /**
     * Delete a publisher by its id.
     * @param publisherId Publisher's id
     * @returns DeleteResult
     */
    public async deleteById(publisherId: string): Promise<DeleteResult> {
        return this.repository.delete({ id: publisherId });
    }

    /**
     * Set the artwork of a publisher.
     * @param idOrObject Publisher id or object
     * @param artwork Updated artwork
     * @returns Publisher
     */
    public async setArtwork(idOrObject: string | Publisher, artwork: Artwork): Promise<Publisher> {
        const publisher = await this.resolvePublisher(idOrObject);
        if(!publisher) throw new NotFoundException("Publisher not found.");

        publisher.artwork = artwork;
        return this.repository.save(publisher);
    }

    /**
     * Resolve a publisher by given id or object
     * @param idOrObject Publisher id or object
     * @returns Publisher
     */
    protected async resolvePublisher(idOrObject: string | Publisher): Promise<Publisher> {
        if(typeof idOrObject == "string") {
            return this.findById(idOrObject);
        }

        return idOrObject;
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Publisher>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        // return this.repository.findAll(pageable, { where: { name: ILike(query) }, relations: ["artwork"]})
        return null;
    }

}
