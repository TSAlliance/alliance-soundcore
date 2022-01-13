import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { Mount } from '../bucket/entities/mount.entity';
import { GeniusService } from '../genius/services/genius.service';
import { CreateAlbumDTO } from './dto/create-album.dto';
import { Album } from './entities/album.entity';
import { AlbumRepository } from './repositories/album.repository';

@Injectable()
export class AlbumService {

    // Search on genius and get info: https://genius.com/api/search/album?q=

    constructor(
        private albumRepository: AlbumRepository,
        @Inject(forwardRef(() => GeniusService)) private geniusService: GeniusService
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
        let album = await this.findByTitle(createAlbumDto.title);
        if(album) return album;

        album = await this.create(createAlbumDto)

        return this.geniusService.findAndApplyAlbumInfo(album, primaryArtistName, mountForArtwork).then(() => {
            return this.albumRepository.save(album);
        }).catch(() => {
            return album
        })
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Album>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        return this.albumRepository.findAll(pageable, { where: { title: ILike(query) }, relations: ["artwork"]})
    }

}
