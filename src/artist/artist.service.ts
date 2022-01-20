import { Injectable, Logger } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { GeniusService } from '../genius/services/genius.service';
import { CreateArtistDTO } from './dtos/create-artist.dto';
import { Artist } from './entities/artist.entity';
import { ArtistRepository } from './repositories/artist.repository';

@Injectable()
export class ArtistService {
    
    private logger: Logger = new Logger(ArtistService.name)

    constructor(
        private geniusService: GeniusService,
        private artistRepository: ArtistRepository
    ){}

    public async findProfileById(artistId: string): Promise<Artist> {
        return this.artistRepository.findOne({ where: { id: artistId }, relations: ["artwork", "banner"]})
    }

    public async findByName(name: string): Promise<Artist> {
        return await this.artistRepository.findOne({ where: { name }});
    }

    public async existsByName(name: string): Promise<boolean> {
        return !!(await this.artistRepository.findOne({ where: { name }}));
    }

    public async createIfNotExists(createArtistDto: CreateArtistDTO): Promise<Artist> {
        // Get artist from db if it does exists.
        let artist = await this.findByName(createArtistDto.name)
        
        // Artist exists? If not, create and gather information
        // Otherwise just return existing artist.
        if(!artist) {

            // Create new artist in database
            artist = await this.artistRepository.save({ 
                name: createArtistDto.name, 
                description: createArtistDto.geniusId, 
                geniusId: createArtistDto.geniusId, 
                geniusUrl: createArtistDto.geniusUrl 
            })

            this.geniusService.findAndApplyArtistInfo(artist, createArtistDto.mountForArtworkId).then(() => {
                this.artistRepository.save(artist);
            }).catch((reason) => {
                this.logger.warn(`Something went wrong whilst gathering information on artist '${createArtistDto.name}': ${reason.message}`)
            })
        }

        return artist;
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Artist>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        return this.artistRepository.findAll(pageable, { where: { name: ILike(query) }, relations: ["artwork"]})
    }

}
