import { Injectable } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { AlbumService } from '../album/album.service';
import { ArtistService } from '../artist/artist.service';
import { DistributorService } from '../distributor/distributor.service';
import { GenreService } from '../genre/genre.service';
import { LabelService } from '../label/label.service';
import { PublisherService } from '../publisher/publisher.service';
import { SongService } from '../song/song.service';
import { ComplexSearchResult } from './entities/complex-search.entity';

@Injectable()
export class SearchService {

    constructor(
        private songService: SongService,
        private artistService: ArtistService,
        private genreService: GenreService,
        private publisherService: PublisherService,
        private distributorService: DistributorService,
        private labelService: LabelService,
        private albumService: AlbumService
    ) {}

    public async complexSearch(query: string, pageable: Pageable): Promise<ComplexSearchResult> {
        const songs = await this.songService.findBySearchQuery(query, pageable);
        const artists = await this.artistService.findBySearchQuery(query, pageable);
        const genres = await this.genreService.findBySearchQuery(query, pageable);
        const publisher = await this.publisherService.findBySearchQuery(query, pageable);
        const distributors = await this.distributorService.findBySearchQuery(query, pageable);
        const labels = await this.labelService.findBySearchQuery(query, pageable);
        const albums = await this.albumService.findBySearchQuery(query, pageable);

        return {
            songs: songs.amount > 0 ? songs : undefined,
            artists: artists.amount > 0 ? artists : undefined,
            genres: genres.amount > 0 ? genres : undefined,
            publisher: publisher.amount > 0 ? publisher : undefined,
            distributors: distributors.amount > 0 ? distributors : undefined,
            labels: labels.amount > 0 ? labels : undefined,
            albums: albums.amount > 0 ? albums : undefined
        }

    }

}
