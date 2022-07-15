import { Injectable } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { AlbumService } from '../album/album.service';
import { ArtistService } from '../artist/artist.service';
import { DistributorService } from '../distributor/services/distributor.service';
import { GenreService } from '../genre/services/genre.service';
import { LabelService } from '../label/services/label.service';
import { MeiliArtistService } from '../meilisearch/services/meili-artist.service';
import { MeiliPlaylistService } from '../meilisearch/services/meili-playlist.service';
import { MeiliUserService } from '../meilisearch/services/meili-user.service';
import { PlaylistService } from '../playlist/playlist.service';
import { PublisherService } from '../publisher/services/publisher.service';
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
        private playlistService: PlaylistService,

        private readonly meiliPlaylist: MeiliPlaylistService,
        private readonly meiliUser: MeiliUserService,
        private readonly meiliArtist: MeiliArtistService
    ) {}

    public async complexSearch(query: string, authentication?: User): Promise<ComplexSearchResult> {
        const settings: Pageable = new Pageable(0, 12);
        
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
            songs: songs.size > 0 ? songs : undefined,
            artists: artists.size > 0 ? artists : undefined,
            genres: genres.size > 0 ? genres : undefined,
            publisher: publisher.size > 0 ? publisher : undefined,
            distributors: distributors.size > 0 ? distributors : undefined,
            labels: labels.size > 0 ? labels : undefined,
            albums: albums.size > 0 ? albums : undefined,
            users: users.size > 0 ? users : undefined,
            playlists: playlists.size > 0 ? playlists : undefined
        }

        if(query && query.length > 0 && query != " ") {
            const bestMatch = await this.findBestMatch(query, searchResult) || undefined;
            searchResult.bestMatch = !!bestMatch.match ? bestMatch : undefined;
        }
        
        if(!searchResult.bestMatch) return null;
        return searchResult
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

    /**
     * Search users by a given query
     * @param {string} query Search query
     * @param {Pageable} pageable Page settings
     * @param {User} authentication Authentication object of the request
     * @returns {SearchResponse<MeiliPlaylist>} SearchResponse<MeiliPlaylist>
     */
    public async searchPlaylists(query: string, pageable: Pageable, authentication: User) {
        return this.meiliPlaylist.searchPlaylists(query, pageable, authentication);
    }

    /**
     * Search users by a given query
     * @param {string} query Search query
     * @param {Pageable} pageable Page settings
     * @returns {SearchResponse<MeiliUser>} SearchResponse<MeiliUser>
     */
    public async searchUsers(query: string, pageable: Pageable) {
        return this.meiliUser.searchUser(query, pageable);
    }

    /**
     * Search artists by a given query
     * @param {string} query Search query
     * @param {Pageable} pageable Page settings
     * @returns {SearchResponse<MeiliArtist>} SearchResponse<MeiliArtist>
     */
     public async searchArtists(query: string, pageable: Pageable) {
        return this.meiliArtist.searchArtists(query, pageable);
    }

}
