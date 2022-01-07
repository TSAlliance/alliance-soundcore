import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { GeniusService } from '../genius/services/genius.service';
import { MOUNT_ID } from '../shared/shared.module';
import { CreateAlbumDTO } from './dto/create-album.dto';
import { Album } from './entities/album.entity';
import { AlbumRepository } from './repositories/album.repository';

@Injectable()
export class AlbumService {

    // Search on genius and get info: https://genius.com/api/search/album?q=

    constructor(
        private albumRepository: AlbumRepository,
        @Inject(MOUNT_ID) private mountId: string
    ) {}

    public async createIfNotExists(createAlbumDto: CreateAlbumDTO): Promise<Album> {
        const existingResult = await this.albumRepository.findOne({ where: { title: createAlbumDto.title }})
        if(existingResult) return existingResult;
        
        const album = await this.albumRepository.save({
            geniusId: createAlbumDto.geniusId,
            title: createAlbumDto.title,
            released: createAlbumDto.released,
            songs: createAlbumDto.songs,
            distributor: createAlbumDto.distributor,
            label: createAlbumDto.label,
            publisher: createAlbumDto.publisher
        })
        return album;
    }

}
