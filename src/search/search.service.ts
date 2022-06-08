import { Injectable } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { AlbumService } from '../album/album.service';
import { ArtistService } from '../artist/artist.service';
import { DistributorService } from '../distributor/distributor.service';
import { GenreService } from '../genre/genre.service';
import { Index } from '../index/entities/index.entity';
import { IndexService } from '../index/services/index.service';
import { LabelService } from '../label/services/label.service';
import { PlaylistService } from '../playlist/playlist.service';
import { PublisherService } from '../publisher/publisher.service';
import { SongService } from '../song/song.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { Levenshtein } from '../utils/levenshtein';
import { SearchBestMatch, SearchBestMatchType } from './entities/best-match.entity';
import { ComplexSearchResult } from './entities/complex-search.entity';

type MatchCandidate = { compareString: string, obj: any, type: SearchBestMatchType };

@Injectable()
export class SearchService {

    constructor(
        private songService: SongService,
        private artistService: ArtistService,
        private genreService: GenreService,
        private publisherService: PublisherService,
        private distributorService: DistributorService,
        private labelService: LabelService,
        private albumService: AlbumService,
        private userService: UserService,
        private indexService: IndexService,
        private playlistService: PlaylistService
    ) {}

    public async complexSearch(query: string, authentication?: User): Promise<ComplexSearchResult> {
        const settings: Pageable = { page: 0, size: 12 }
        
        const songs = await this.songService.findBySearchQuery(query, settings, authentication);
        const artists = await this.artistService.findBySearchQuery(query, settings);
        const genres = await this.genreService.findBySearchQuery(query, settings);
        const publisher = await this.publisherService.findBySearchQuery(query, settings);
        const distributors = await this.distributorService.findBySearchQuery(query, settings);
        const labels = await this.labelService.findBySearchQuery(query, settings);
        const albums = await this.albumService.findBySearchQuery(query, settings);
        const users = await this.userService.findBySearchQuery(query, settings);
        const playlists = await this.playlistService.findBySearchQuery(query, settings, authentication);

        const searchResult: ComplexSearchResult = {
            songs: songs.amount > 0 ? songs : undefined,
            artists: artists.amount > 0 ? artists : undefined,
            genres: genres.amount > 0 ? genres : undefined,
            publisher: publisher.amount > 0 ? publisher : undefined,
            distributors: distributors.amount > 0 ? distributors : undefined,
            labels: labels.amount > 0 ? labels : undefined,
            albums: albums.amount > 0 ? albums : undefined,
            users: users.amount > 0 ? users : undefined,
            playlists: playlists.amount > 0 ? playlists : undefined
        }

        if(query && query.length > 0 && query != " ") {
            const bestMatch = await this.findBestMatch(query, searchResult) || undefined;
            searchResult.bestMatch = !!bestMatch.match ? bestMatch : undefined;
        }
        
        if(!searchResult.bestMatch) return null;
        return searchResult
    }

    public async searchIndexInMount(query: string, mountId: string, pageable: Pageable): Promise<Page<Index>> {       
        return this.indexService.findBySearchQueryInMount(query, mountId, pageable)
    }

    public async findBestMatch(needle: string, haystack: ComplexSearchResult): Promise<SearchBestMatch> {
        const candidates: MatchCandidate[] = [];

        if(haystack.albums) candidates.push(...haystack.albums?.elements.map((x) => ({ compareString: x.name, obj: x, type: "album" as SearchBestMatchType })))
        if(haystack.songs) candidates.push(...haystack.songs?.elements.map((x) => ({ compareString: x.name, obj: x, type: "song" as SearchBestMatchType })))
        if(haystack.artists) candidates.push(...haystack.artists?.elements.map((x) => ({ compareString: x.name, obj: x, type: "artist" as SearchBestMatchType })))
        if(haystack.genres) candidates.push(...haystack.genres?.elements.map((x) => ({ compareString: x.name, obj: x, type: "genre" as SearchBestMatchType })))
        if(haystack.publisher) candidates.push(...haystack.publisher?.elements.map((x) => ({ compareString: x.name, obj: x, type: "publisher" as SearchBestMatchType })))
        if(haystack.distributors) candidates.push(...haystack.distributors?.elements.map((x) => ({ compareString: x.name, obj: x, type: "distributor" as SearchBestMatchType })))
        if(haystack.labels) candidates.push(...haystack.labels?.elements.map((x) => ({ compareString: x.name, obj: x, type: "label" as SearchBestMatchType })))
        if(haystack.users) candidates.push(...haystack.users?.elements.map((x) => ({ compareString: x.name, obj: x, type: "user" as SearchBestMatchType })))
        if(haystack.playlists) candidates.push(...haystack.playlists?.elements.map((x) => ({ compareString: x.name, obj: x, type: "playlist" as SearchBestMatchType })))

        let bestMatch: { score: number, value: MatchCandidate, type: SearchBestMatchType } = { score: 0, value: null, type: "song"};

        // Return if its only one or zero entries
        if(candidates.length <= 0) return { match: undefined, type: undefined };
        if(candidates.length == 1) return { match: candidates[0]?.obj, type: candidates[0]?.type };

        for(const candidate of candidates) {
            const score = Levenshtein.getEditDistance(candidate.compareString.toLowerCase(), needle.toLowerCase());
            if(score < bestMatch.score || bestMatch.value == null) bestMatch = { score, value: candidate, type: candidate.type };
        }

        if(!bestMatch) return null;
        return {
            type: bestMatch.type,
            match: bestMatch.value.obj
        };
    }



}
