import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Artwork } from '../../artwork/entities/artwork.entity';
import { RedlockError } from '../../exceptions/redlock.exception';
import { SyncFlag } from '../../meilisearch/interfaces/syncable.interface';
import { MeiliLabelService } from '../../meilisearch/services/meili-label.service';
import { CreateResult } from '../../utils/results/creation.result';
import { RedisLockableService } from '../../utils/services/redis-lockable.service';
import { CreateLabelDTO } from '../dtos/create-label.dto';
import { UpdateLabelDTO } from '../dtos/update-label.dto';
import { Label } from '../entities/label.entity';

@Injectable()
export class LabelService extends RedisLockableService {
    private readonly logger: Logger = new Logger(LabelService.name);

    constructor(
        @InjectRepository(Label) private readonly repository: Repository<Label>,
        private readonly meiliClient: MeiliLabelService
    ){
        super()
    }

    /**
     * Find a label by its id.
     * @param name Label's id
     * @returns Label
     */
    public async findById(labelId: string): Promise<Label> {
        return this.repository.createQueryBuilder("label")
            .leftJoin("label.artwork", "artwork")
            .addSelect(["artwork.id"])
            .where("label.id = :labelId", { labelId })
            .getOne();
    }

    /**
     * Find a label by its name.
     * @param name Label's name
     * @returns Label
     */
    public async findByName(name: string): Promise<Label> {
        return this.repository.createQueryBuilder("label")
            .leftJoin("label.artwork", "artwork")
            .addSelect(["artwork.id"])
            .where("label.name = :name", { name })
            .getOne();
    }

    /**
     * Save a label entity.
     * @param label Entity data to be saved
     * @returns Label
     */
    public async save(label: Label): Promise<Label> {
        return this.repository.save(label).then((result) => {
            this.sync([result]);
            return result;
        });
    }

    /**
     * Create new label by name if it does not already exist in the database.
     * @param createLabelDto Label data to create
     * @returns Label
     */
    public async createIfNotExists(createLabelDto: CreateLabelDTO, waitForLock = false): Promise<CreateResult<Label>> {
        createLabelDto.name = createLabelDto.name?.trim();
        createLabelDto.description = createLabelDto.description?.trim();

        // Acquire lock
        return this.lock(createLabelDto.name, async (signal) => {
            // Check if label exists
            const existingLabel = await this.findByName(createLabelDto.name);
            if(existingLabel) return new CreateResult(existingLabel, true); 
            if(signal.aborted) throw new RedlockError();

            const label = new Label();
            label.name = createLabelDto.name;
            label.geniusId = createLabelDto.geniusId;
            label.description = createLabelDto.description;

            return this.save(label).then((result) => {
                return new CreateResult(result, false)
            })
        }, waitForLock).catch((error: Error) => {
            this.logger.error(`Failed creating label: ${error.message}`, error.stack);
            throw new InternalServerErrorException();
        });
    }

    /**
     * Update a label.
     * @param labelId Label's id
     * @param updateLabelDto Updated data.
     * @returns Label
     */
    public async update(labelId: string, updateLabelDto: UpdateLabelDTO): Promise<Label> {
        updateLabelDto.name = updateLabelDto.name?.trim();
        updateLabelDto.description = updateLabelDto.description?.trim();

        const label = await this.findById(labelId);
        if(!label) throw new NotFoundException("Label not found.");

        label.name = updateLabelDto.name;
        label.geniusId = updateLabelDto.geniusId;
        label.description = updateLabelDto.description;

        return this.save(label);
    }

    /**
     * Delete a label by its id.
     * @param labelId Label's id
     * @returns True or False
     */
    public async deleteById(labelId: string): Promise<boolean> {
        return this.meiliClient.deleteLabel(labelId).then(() => {
            return this.repository.delete({ id: labelId }).then((value) => {
                return value.affected > 0;
            });
        });
    }

    /**
     * Set the artwork of a label.
     * @param idOrObject Label id or object
     * @param artwork Updated artwork
     * @returns Label
     */
    public async setArtwork(idOrObject: string | Label, artwork: Artwork): Promise<Label> {
        const label = await this.resolveLabel(idOrObject);
        if(!label) throw new NotFoundException("Label not found.");

        label.artwork = artwork;
        return this.repository.save(label);
    }

    /**
     * Resolve a label by given id or object
     * @param idOrObject Label id or object
     * @returns Label
     */
    protected async resolveLabel(idOrObject: string | Label): Promise<Label> {
        if(typeof idOrObject == "string") {
            return this.findById(idOrObject);
        }

        return idOrObject;
    }

    /**
     * Update the sync flag of a label.
     * @param idOrObject Id or object of the label
     * @param flag Updated sync flag
     * @returns Label
     */
    private async setSyncFlags(resources: Label[], flag: SyncFlag) {
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
     * @param resources Label data
     * @returns Label
     */
    private async sync(resources: Label[]) {
        return this.meiliClient.setLabels(resources).then(() => {
            return this.setSyncFlags(resources, SyncFlag.OK);
        }).catch(() => {
            return this.setSyncFlags(resources, SyncFlag.ERROR);
        });
    }

}
