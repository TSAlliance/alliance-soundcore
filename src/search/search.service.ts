import { Injectable } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { ArtistService } from '../artist/artist.service';
import { SongService } from '../song/song.service';
import { ComplexSearchResult } from './entities/complex-search.entity';

@Injectable()
export class SearchService {

    constructor(
        private songService: SongService,
        private artistService: ArtistService
    ) {}

    public async complexSearch(query: string, pageable: Pageable): Promise<ComplexSearchResult> {
        const songs = await this.songService.findBySearchQuery(query, pageable)
        const artists = await this.artistService.findBySearchQuery(query, pageable)

        // TODO: Create proper type
        return {
            songs,
            artists
        }

    }

}
