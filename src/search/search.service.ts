import { Injectable } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { ArtistService } from '../artist/artist.service';
import { GenreService } from '../genre/genre.service';
import { SongService } from '../song/song.service';
import { ComplexSearchResult } from './entities/complex-search.entity';

@Injectable()
export class SearchService {

    constructor(
        private songService: SongService,
        private artistService: ArtistService,
        private genreService: GenreService
    ) {}

    public async complexSearch(query: string, pageable: Pageable): Promise<ComplexSearchResult> {
        const songs = await this.songService.findBySearchQuery(query, pageable);
        const artists = await this.artistService.findBySearchQuery(query, pageable);
        const genres = await this.genreService.findBySearchQuery(query, pageable);

        return {
            songs: songs.amount > 0 ? songs : undefined,
            artists: artists.amount > 0 ? artists : undefined,
            genres: genres.amount > 0 ? genres : undefined
        }

    }

}
