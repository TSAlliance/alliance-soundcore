import { Injectable } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { AlbumService } from '../album/album.service';
import { ArtistService } from '../artist/artist.service';
import { DistributorService } from '../distributor/distributor.service';
import { GenreService } from '../genre/genre.service';
import { LabelService } from '../label/label.service';
import { PublisherService } from '../publisher/publisher.service';
import { SongService } from '../song/song.service';
import { Levenshtein } from '../utils/levenshtein';
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

    public async complexSearch(query: string): Promise<ComplexSearchResult> {
        const settings: Pageable = { page: 0, size: 12 }
        
        const songs = await this.songService.findBySearchQuery(query, settings);
        const artists = await this.artistService.findBySearchQuery(query, settings);
        const genres = await this.genreService.findBySearchQuery(query, settings);
        const publisher = await this.publisherService.findBySearchQuery(query, settings);
        const distributors = await this.distributorService.findBySearchQuery(query, settings);
        const labels = await this.labelService.findBySearchQuery(query, settings);
        const albums = await this.albumService.findBySearchQuery(query, settings);

        const searchResult: ComplexSearchResult = {
            songs: songs.amount > 0 ? songs : undefined,
            artists: artists.amount > 0 ? artists : undefined,
            genres: genres.amount > 0 ? genres : undefined,
            publisher: publisher.amount > 0 ? publisher : undefined,
            distributors: distributors.amount > 0 ? distributors : undefined,
            labels: labels.amount > 0 ? labels : undefined,
            albums: albums.amount > 0 ? albums : undefined
        }

        if(query && query.length > 0 && query != " ") {
            searchResult.bestMatch = await this.findBestMatch(query, searchResult) || undefined;
        }
        
        return searchResult

    }

    public async findBestMatch(needle: string, haystack: ComplexSearchResult): Promise<any> {
        let candidates: { compareString: string, obj: any }[] = [];

        if(haystack.albums) candidates.push(...haystack.albums?.elements.map((x) => ({ compareString: x.title, obj: x })))
        if(haystack.songs) candidates.push(...haystack.songs?.elements.map((x) => ({ compareString: x.title, obj: x })))
        if(haystack.artists) candidates.push(...haystack.artists?.elements.map((x) => ({ compareString: x.name, obj: x })))
        if(haystack.genres) candidates.push(...haystack.genres?.elements.map((x) => ({ compareString: x.name, obj: x })))
        if(haystack.publisher) candidates.push(...haystack.publisher?.elements.map((x) => ({ compareString: x.name, obj: x })))
        if(haystack.distributors) candidates.push(...haystack.distributors?.elements.map((x) => ({ compareString: x.name, obj: x })))
        if(haystack.labels) candidates.push(...haystack.labels?.elements.map((x) => ({ compareString: x.name, obj: x })))

        let bestMatch: { score: number, value: any } = { score: 0, value: null};

        // Return if its only one or zero entries
        if(candidates.length <= 1) return candidates[0].obj;

        const strLen = candidates.sort((a, b) => b.compareString.length - a.compareString.length)[0]?.compareString.length;

        candidates = candidates.map((candidate) => {
            for(let i = candidate.compareString.length; i < strLen; i++) {
                candidate.compareString += " ";
            }

            return candidate
        })

        for(const candidate of candidates) {
            const score = Levenshtein.getEditDistance(candidate.compareString.toLowerCase(), needle.toLowerCase());
            console.log([score, candidate.compareString])
            if(score < bestMatch.score || bestMatch.value == null) bestMatch = { score, value: candidate};
        }

        return bestMatch.value;
    }



}
