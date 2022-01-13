import { Injectable } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { Mount } from '../bucket/entities/mount.entity';
import { GeniusService } from '../genius/services/genius.service';
import { Artist } from './entities/artist.entity';
import { ArtistRepository } from './repositories/artist.repository';

@Injectable()
export class ArtistService {
    

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

    public async createIfNotExists(name: string, mountForArtwork?: Mount): Promise<Artist> {
        const artist = await this.findByName(name) || await this.artistRepository.save({ name })

        return this.geniusService.findAndApplyArtistInfo(artist, mountForArtwork).then(() => {
            return this.artistRepository.save(artist);
        }).catch(() => {
            return artist
        })
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
