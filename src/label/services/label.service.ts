import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { DeleteResult, ILike } from 'typeorm';
import { Artwork } from '../../artwork/entities/artwork.entity';
import { RedlockError } from '../../exceptions/redlock.exception';
import { CreateResult } from '../../utils/results/creation.result';
import { RedisLockableService } from '../../utils/services/redis-lockable.service';
import { CreateLabelDTO } from '../dtos/create-label.dto';
import { UpdateLabelDTO } from '../dtos/update-label.dto';
import { Label } from '../entities/label.entity';
import { LabelRepository } from '../repositories/label.repository';

@Injectable()
export class LabelService extends RedisLockableService {
    private readonly logger: Logger = new Logger(LabelService.name);

    constructor(
        private readonly repository: LabelRepository
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
     * Create new label by name if it does not already exist in the database.
     * @param createLabelDto Label data to create
     * @returns Label
     */
    public async createIfNotExists(createLabelDto: CreateLabelDTO): Promise<CreateResult<Label>> {
        createLabelDto.name = createLabelDto.name?.replace(/^[ ]+|[ ]+$/g,'')?.trim();
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

            return this.repository.save(label).then((result) => {
                return new CreateResult(result, false)
            })
        })
    }

    /**
     * Update a label.
     * @param labelId Label's id
     * @param updateLabelDto Updated data.
     * @returns Label
     */
    public async update(labelId: string, updateLabelDto: UpdateLabelDTO): Promise<Label> {
        updateLabelDto.name = updateLabelDto.name?.replace(/^[ ]+|[ ]+$/g,'')?.trim();
        updateLabelDto.description = updateLabelDto.description?.trim();

        const label = await this.findById(labelId);
        if(!label) throw new NotFoundException("Label not found.");

        label.name = updateLabelDto.name;
        label.geniusId = updateLabelDto.geniusId;
        label.description = updateLabelDto.description;

        return this.repository.save(label);
    }

    /**
     * Delete a label by its id.
     * @param labelId Label's id
     * @returns DeleteResult
     */
    public async deleteById(labelId: string): Promise<DeleteResult> {
        return this.repository.delete({ id: labelId });
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

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Label>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        return this.repository.findAll(pageable, { where: { name: ILike(query) }, relations: ["artwork"]})
    }

}
