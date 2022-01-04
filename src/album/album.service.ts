import { Injectable } from '@nestjs/common';
import { Artist } from '../artist/entities/artist.entity';
import { GeniusService } from '../genius/services/genius.service';
import { CreateAlbumDTO } from './dto/create-album.dto';
import { Album } from './entities/album.entity';
import { AlbumRepository } from './repositories/album.repository';

@Injectable()
export class AlbumService {

    // Search on genius and get info: https://genius.com/api/search/album?q=

    constructor(
        private geniusService: GeniusService,
        private albumRepository: AlbumRepository
    ) {}

    public async findByTitle(title: string): Promise<Album> {
        return this.albumRepository.findOne({ where: { title }});
    }

    public async create(createAlbumDto: CreateAlbumDTO): Promise<Album> {
        const album = await this.findByTitle(createAlbumDto.title);
        let result;

        if(!album) {
            result = await this.albumRepository.save({ title: createAlbumDto.title });
        } else {
            result = album;
        }

        if(createAlbumDto.artists) {
            result.artists = createAlbumDto.artists;
            await this.albumRepository.save(result)
        }
        
        return result;
    }

    public async createIfNotExists(title: string, artists: Artist[]): Promise<Album> {
        if(!title) return;
        const album = await this.create({ title });
        // TODO: Find album info
        // this.geniusService.
        return album;
    }

}
