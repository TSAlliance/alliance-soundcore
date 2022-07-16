import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Page, Pageable } from 'nestjs-pager';
import { DeleteResult, Repository } from 'typeorm';
import { Artwork } from '../../artwork/entities/artwork.entity';
import { RedlockError } from '../../exceptions/redlock.exception';
import { CreateResult } from '../../utils/results/creation.result';
import { RedisLockableService } from '../../utils/services/redis-lockable.service';
import { CreateDistributorDTO } from '../dtos/create-distributor.dto';
import { UpdateDistributorDTO } from '../dtos/update-distributor.dto';
import { Distributor } from '../entities/distributor.entity';

@Injectable()
export class DistributorService extends RedisLockableService {
    private logger: Logger = new Logger(DistributorService.name)

    constructor(
        @InjectRepository(Distributor) private readonly repository: Repository<Distributor>,
    ){
        super()
    }

    /**
     * Find a distributor by its id.
     * @param name Distributor's id
     * @returns Distributor
     */
     public async findById(distributorId: string): Promise<Distributor> {
        return this.repository.createQueryBuilder("distributor")
            .leftJoin("distributor.artwork", "artwork")
            .addSelect(["artwork.id"])
            .where("distributor.id = :distributorId", { distributorId })
            .getOne();
    }

    /**
     * Find a distributor by its name.
     * @param name Distributor's name
     * @returns Distributor
     */
    public async findByName(name: string): Promise<Distributor> {
        return this.repository.createQueryBuilder("distributor")
            .leftJoin("distributor.artwork", "artwork")
            .addSelect(["artwork.id"])
            .where("distributor.name = :name", { name })
            .getOne();
    }

    /**
     * Create new distributor by name if it does not already exist in the database.
     * @param createDistributorDto Publisher data to create
     * @returns CreateResult<Distributor>
     */
    public async createIfNotExists(createDistributorDto: CreateDistributorDTO, waitForLock = false): Promise<CreateResult<Distributor>> {
        createDistributorDto.name = createDistributorDto.name.trim();
        createDistributorDto.description = createDistributorDto.description?.trim();

        // Acquire lock
        return this.lock(createDistributorDto.name, async (signal) => {
            // Check if distributor exists
            const existingDistributor = await this.findByName(createDistributorDto.name);
            if(existingDistributor) return new CreateResult(existingDistributor, true); 
            if(signal.aborted) throw new RedlockError();

            const distributor = new Distributor();
            distributor.name = createDistributorDto.name;
            distributor.geniusId = createDistributorDto.geniusId;
            distributor.description = createDistributorDto.description;

            return this.repository.save(distributor).then((result) => {
                return new CreateResult(result, false)
            })
        }, waitForLock).catch((error: Error) => {
            this.logger.error(`Failed creating distributor: ${error.message}`, error.stack);
            throw new InternalServerErrorException();
        });
    }

    /**
     * Update a distributor.
     * @param distributorId Distributor's id
     * @param updateDistributorDto Updated data.
     * @returns Distributor
     */
    public async update(distributorId: string, updateDistributorDto: UpdateDistributorDTO): Promise<Distributor> {
        updateDistributorDto.name = updateDistributorDto.name.trim();
        updateDistributorDto.description = updateDistributorDto.description?.trim();

        const distributor = await this.findById(distributorId);
        if(!distributor) throw new NotFoundException("Distributor not found.");

        distributor.name = updateDistributorDto.name;
        distributor.geniusId = updateDistributorDto.geniusId;
        distributor.description = updateDistributorDto.description;

        return this.repository.save(distributor);
    }

    /**
     * Delete a distributor by its id.
     * @param distributorId Distributor's id
     * @returns DeleteResult
     */
    public async deleteById(distributorId: string): Promise<DeleteResult> {
        return this.repository.delete({ id: distributorId });
    }

    /**
     * Set the artwork of a distributor.
     * @param idOrObject Distributor id or object
     * @param artwork Updated artwork
     * @returns Distributor
     */
    public async setArtwork(idOrObject: string | Distributor, artwork: Artwork): Promise<Distributor> {
        const distributor = await this.resolveDistributor(idOrObject);
        if(!distributor) throw new NotFoundException("Distributor not found.");

        distributor.artwork = artwork;
        return this.repository.save(distributor);
    }

    /**
     * Resolve a distributor by given id or object
     * @param idOrObject Distributor id or object
     * @returns Distributor
     */
    protected async resolveDistributor(idOrObject: string | Distributor): Promise<Distributor> {
        if(typeof idOrObject == "string") {
            return this.findById(idOrObject);
        }

        return idOrObject;
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Distributor>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        // return this.repository.findAll(pageable, { where: { name: ILike(query) }, relations: ["artwork"]})
        return null;
    }

}
