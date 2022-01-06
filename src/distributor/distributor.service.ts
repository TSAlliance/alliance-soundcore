import { Inject, Injectable, Logger } from '@nestjs/common';
import { ArtworkService } from '../artwork/artwork.service';
import { MOUNT_ID } from '../shared/shared.module';
import { CreateDistributorDTO } from './dtos/create-distributor.dto';
import { Distributor } from './entities/distributor.entity';
import { DistributorRepository } from './repositories/distributor.repository';

@Injectable()
export class DistributorService {
    private logger: Logger = new Logger(DistributorService.name)

    constructor(
        private artworkService: ArtworkService,
        private distributorRepository: DistributorRepository,
        @Inject(MOUNT_ID) private mountId: string
    ){}

    /**
     * Create new distributor by name if it does not already exist in the database.
     * @param createDistributorDto Publisher data to create
     * @returns Distributor
     */
    public async createIfNotExists(createDistributorDto: CreateDistributorDTO): Promise<Distributor> {
        const distributor: Distributor = await this.distributorRepository.findOne({ where: { name: createDistributorDto.name }})
        if(distributor) return distributor;

        const distributorResult = await this.distributorRepository.save({
            name: createDistributorDto.name,
            geniusId: createDistributorDto.geniusId
        })

        if(!distributorResult) {
            this.logger.error("Could not create distributor.")
            return null;
        }

        if(createDistributorDto.externalImgUrl) {
            const artwork = await this.artworkService.create({ 
                type: "distributor",
                url: createDistributorDto.externalImgUrl,
                autoDownload: true,
                mountId: createDistributorDto.artworkMountId || this.mountId
            })
            if(artwork) distributorResult.artwork = artwork
        }

        return this.distributorRepository.save(distributorResult)
    }

}
