import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Artwork } from '../../artwork/entities/artwork.entity';
import { RedlockError } from '../../exceptions/redlock.exception';
import { SyncFlag } from '../../meilisearch/interfaces/syncable.interface';
import { MeiliDistributorService } from '../../meilisearch/services/meili-distributor.service';
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
        private readonly meiliClient: MeiliDistributorService
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
     * Save a distributor entity.
     * @param distributor Entity data to be saved
     * @returns Distributor
     */
    public async save(distributor: Distributor): Promise<Distributor> {
        return this.repository.save(distributor).then((result) => {
            this.sync([result]);
            return result;
        });
    }

    /**
     * Create new distributor by name if it does not already exist in the database.
     * @param createDistributorDto Distributor data to create
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

            return this.save(distributor).then((result) => {
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

        return this.save(distributor);
    }

    /**
     * Delete a distributor by its id.
     * @param distributorId Distributor's id
     * @returns boolean
     */
    public async deleteById(distributorId: string): Promise<boolean> {
        return this.meiliClient.deleteDistributor(distributorId).then(() => {
            return this.repository.delete({ id: distributorId }).then((value) => {
                return value.affected > 0;
            });
        });
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

    /**
     * Update the sync flag of a distributor.
     * @param resources Id or object of the distributor
     * @param flag Updated sync flag
     * @returns UpdateResult
     */
    private async setSyncFlags(resources: Distributor[], flag: SyncFlag) {
        const ids = resources.map((user) => user.id);

        return this.repository.createQueryBuilder()
            .update({
                lastSyncedAt: new Date(),
                lastSyncFlag: flag
            })
            .where({ id: In(ids) })
            .execute();
    }

    /**
     * Synchronize the corresponding document on meilisearch.
     * @param resources Distributor data
     * @returns UpdateResult
     */
    private async sync(resources: Distributor[]) {
        return this.meiliClient.setDistributors(resources).then(() => {
            return this.setSyncFlags(resources, SyncFlag.OK);
        }).catch(() => {
            return this.setSyncFlags(resources, SyncFlag.ERROR);
        });
    }

}
