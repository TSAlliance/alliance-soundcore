import { Inject, Injectable } from '@nestjs/common';
import { ArtworkService } from '../artwork/artwork.service';
import { Mount } from '../bucket/entities/mount.entity';
import { GeniusService } from '../genius/services/genius.service';
import { MOUNT_ID } from '../shared/shared.module';
import { CreateAlbumDTO } from './dto/create-album.dto';
import { Album } from './entities/album.entity';
import { AlbumRepository } from './repositories/album.repository';

@Injectable()
export class AlbumService {

    // Search on genius and get info: https://genius.com/api/search/album?q=

    constructor(
        private artworkService: ArtworkService,
        private geniusService: GeniusService,
        private albumRepository: AlbumRepository
    ) {}

    public async findByTitle(title: string): Promise<Album> {
        return await this.albumRepository.findOne({ where: { title }});
    }

    public async existsByTitle(title: string): Promise<boolean> {
        return !!(await this.findByTitle(title));
    }

    private async create(createAlbumDto: CreateAlbumDTO): Promise<Album> {
        return this.albumRepository.save({
            geniusId: createAlbumDto.geniusId,
            title: createAlbumDto.title,
            released: createAlbumDto.released,
            artists: createAlbumDto.artists,
            distributor: createAlbumDto.distributor,
            label: createAlbumDto.label,
            publisher: createAlbumDto.publisher
        })
    }

    public async createIfNotExists(createAlbumDto: CreateAlbumDTO, primaryArtistName: string, mountForArtwork?: Mount): Promise<Album> {
        const album = await this.findByTitle(createAlbumDto.title) || await this.create(createAlbumDto)

        return this.geniusService.findAndApplyAlbumInfo(album, primaryArtistName, mountForArtwork).then(() => {
            return this.albumRepository.save(album);
        }).catch(() => {
            return album
        })
    }

    /*public async createIfNotExists(createAlbumDto: CreateAlbumDTO): Promise<Album> {
        const existingResult = await this.albumRepository.findOne({ where: { title: createAlbumDto.title }})
        if(existingResult) return existingResult;
        
        const album = await this.albumRepository.save({
            geniusId: createAlbumDto.geniusId,
            title: createAlbumDto.title,
            released: createAlbumDto.released,
            songs: createAlbumDto.songs,
            artists: createAlbumDto.artists,
            distributor: createAlbumDto.distributor,
            label: createAlbumDto.label,
            publisher: createAlbumDto.publisher
        })



        return album;
    }*/

}
