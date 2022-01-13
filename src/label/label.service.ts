import { Inject, Injectable, Logger } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { ArtworkService } from '../artwork/artwork.service';
import { MOUNT_ID } from '../shared/shared.module';
import { CreateLabelDTO } from './dtos/create-label.dto';
import { Label } from './entities/label.entity';
import { LabelRepository } from './repositories/label.repository';

@Injectable()
export class LabelService {
    private logger: Logger = new Logger(LabelService.name);

    constructor(
        private artworkService: ArtworkService,
        private lableRepository: LabelRepository,
        @Inject(MOUNT_ID) private mountId: string
    ){}

    /**
     * Create new label by name if it does not already exist in the database.
     * @param createLabelDto Label data to create
     * @returns Label
     */
     public async createIfNotExists(createLabelDto: CreateLabelDTO): Promise<Label> {
        const label: Label = await this.lableRepository.findOne({ where: { name: createLabelDto.name }})
        if(label) return label;

        const labelResult = await this.lableRepository.save({
            name: createLabelDto.name,
            geniusId: createLabelDto.geniusId
        })

        if(!labelResult) {
            this.logger.error("Could not create label.")
            return null;
        }

        if(createLabelDto.externalImgUrl) {
            const artwork = await this.artworkService.create({ 
                type: "label",
                url: createLabelDto.externalImgUrl ,
                autoDownload: true,
                mountId: createLabelDto.artworkMountId || this.mountId,
                dstFilename: labelResult.name
            })
            if(artwork) labelResult.artwork = artwork
        }

        return this.lableRepository.save(labelResult)
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Label>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        return this.lableRepository.findAll(pageable, { where: { name: ILike(query) }, relations: ["artwork"]})
    }

}
