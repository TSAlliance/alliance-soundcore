import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ArtworkService } from '../artwork/artwork.service';
import { MOUNT_ID } from '../shared/shared.module';
import { CreateLabelDTO } from './dtos/create-label.dto';
import { Label } from './entities/label.entity';
import { LabelRepository } from './repositories/label.repository';

@Injectable()
export class LabelService {

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

        if(!labelResult) throw new InternalServerErrorException("Could not create label.")

        if(createLabelDto.externalImgUrl) {
            const artwork = await this.artworkService.create({ 
                type: "label",
                url: createLabelDto.externalImgUrl ,
                autoDownload: true,
                mountId: createLabelDto.artworkMountId || this.mountId
            })
            if(artwork) labelResult.artwork = artwork
        }

        return this.lableRepository.save(labelResult)
    }

}
