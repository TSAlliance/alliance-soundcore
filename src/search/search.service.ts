import { Injectable } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { DistributorService } from '../distributor/services/distributor.service';
import { LabelService } from '../label/services/label.service';
import { MeiliAlbumService } from '../meilisearch/services/meili-album.service';
import { MeiliArtistService } from '../meilisearch/services/meili-artist.service';
import { MeiliPlaylistService } from '../meilisearch/services/meili-playlist.service';
import { MeiliSongService } from '../meilisearch/services/meili-song.service';
import { MeiliUserService } from '../meilisearch/services/meili-user.service';
import { PublisherService } from '../publisher/services/publisher.service';
import { User } from '../user/entities/user.entity';
import { Levenshtein } from '../utils/levenshtein';
import { SearchBestMatch, SearchBestMatchType } from './entities/best-match.entity';
import { ComplexSearchResult } from './entities/complex-search.entity';

type MatchCandidate = { compareString: string, obj: any, type: SearchBestMatchType };

@Injectable()
export class SearchService {

    constructor(
        private publisherService: PublisherService,
        private distributorService: DistributorService,
        private labelService: LabelService,

        private readonly meiliPlaylist: MeiliPlaylistService,
        private readonly meiliUser: MeiliUserService,
        private readonly meiliArtist: MeiliArtistService,
        private readonly meiliAlbum: MeiliAlbumService,
        private readonly meiliSong: MeiliSongService
    ) {}

    public async complexSearch(query: string, authentication?: User): Promise<ComplexSearchResult> {
        const settings: Pageable = new Pageable(0, 12);
        
        const publisher = await this.publisherService.findBySearchQuery(query, settings);
        const distributors = await this.distributorService.findBySearchQuery(query, settings);
        const labels = await this.labelService.findBySearchQuery(query, settings);

        const searchResult: ComplexSearchResult = {
            songs: undefined,
            artists: undefined,
            genres: undefined,
            publisher: publisher.size > 0 ? publisher : undefined,
            distributors: distributors.size > 0 ? distributors : undefined,
            labels: labels.size > 0 ? labels : undefined,
            albums: undefined,
            users: undefined,
            playlists: undefined
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

    /**
     * Search albums by a given query
     * @param {string} query Search query
     * @param {Pageable} pageable Page settings
     * @returns {SearchResponse<MeiliAlbum>} SearchResponse<MeiliAlbum>
     */
    public async searchAlbums(query: string, pageable: Pageable) {
        return this.meiliAlbum.searchAlbums(query, pageable);
    }

    /**
     * Search songs by a given query
     * @param {string} query Search query
     * @param {Pageable} pageable Page settings
     * @returns {SearchResponse<MeiliSong>} SearchResponse<MeiliSong>
     */
    public async searchSongs(query: string, pageable: Pageable) {
        return this.meiliSong.searchSongs(query, pageable);
    }

}
