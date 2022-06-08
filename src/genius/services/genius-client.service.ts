import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosResponse } from "axios";
import { Album } from "../../album/entities/album.entity";
import { Artist } from "../../artist/entities/artist.entity";
import { ArtworkType } from "../../artwork/entities/artwork.entity";
import { ArtworkService } from "../../artwork/services/artwork.service";
import { GENIUS_API_BASE_URL } from "../../constants";
import { Label } from "../../label/entities/label.entity";
import { LabelService } from "../../label/services/label.service";
import { Mount } from "../../mount/entities/mount.entity";
import { Song } from "../../song/entities/song.entity";
import { Levenshtein } from "../../utils/levenshtein";
import { GeniusAlbumDTO } from "../lib/genius-album.dto";
import { GeniusArtistDTO } from "../lib/genius-artist.dto";
import { GeniusReponseDTO, GeniusSearchResponse } from "../lib/genius-response.dto";
import { GeniusSearchPageResultDTO } from "../lib/genius-search-page.dto";
import { GeniusSongDTO } from "../lib/genius-song.dto";

@Injectable()
export class GeniusClientService {
    private readonly logger: Logger = new Logger(GeniusClientService.name);

    constructor(
        private readonly artworkService: ArtworkService,
        private readonly labelService: LabelService
    ) {}

    /**
     * Find artist information on genius.com. If found, all information are applied and returned as new artist object.
     * @param artist Artist to lookup
     * @param useMount Mount to use for artist's images
     * @returns Artist
     */
    public async lookupArtist(artist: Artist, useMount: Mount): Promise<Artist> {
        const result: Artist = Object.assign(new Artist(), artist);

        // Get the resource id from given artist object.
        // If the object has no geniusId, try and search a matching id
        // on genius.com. Fail, if this was not possible
        const resourceId = artist.geniusId ? artist.geniusId : await this.searchResourceIdOfType("artist", artist.name);
        if(!resourceId) return artist;

        // Request more detailed song data
        return this.fetchResourceByIdAndType<GeniusArtistDTO>("artist", resourceId).then(async (resource) => {
            // If there is an invalid response (e.g. errors)
            // then return unmodified artist object.
            if(!resource) return artist;

            result.geniusId = resource.id;
            result.description = resource.description_preview;

            // If there is an image url present on the resource.
            // Download it and create an artwork for the artist
            if(resource.image_url) {
                // Create new artwork in database
                const artwork = await this.artworkService.createIfNotExists({
                    name: artist.name,
                    type: ArtworkType.ARTIST,
                    mount: useMount,
                    fromSource: null
                });

                // Continue only if artwork was created
                if(!!artwork) {
                    // Download url to buffer
                    const artworkResult = await this.artworkService.downloadToBuffer(resource.image_url).then((buffer) => {
                        // Write buffer to artwork file.
                        return this.artworkService.writeFromBufferOrFile(buffer, artwork);
                    }).catch(async (error) => {
                        // Delete artwork entity if write failed.
                        await this.artworkService.deleteById(artwork.id);
                        throw error;
                    })

                    // Update relation
                    result.artwork = artworkResult;
                }
            }

            return result;
        });
    }

    /**
     * Find album information on genius.com. If found, all information are applied and returned as new artist object.
     * @param album Album to lookup
     * @param mount Mount to use for album's images
     * @returns Album
     */
     public async lookupAlbum(album: Album, mount: Mount): Promise<Album> {
        const result: Album = Object.assign(new Album(), album);
        const title = album?.name?.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, "").split("-")[0].trim();
        const artist = album.primaryArtist.name;
        const searchQuery = `${title} ${artist}`

        // Get the resource id from given album object.
        // If the object has no geniusId, try and search a matching id
        // on genius.com. Fail, if this was not possible
        const resourceId = album.geniusId ? album.geniusId : await this.searchResourceIdOfType("album", searchQuery);
        if(!resourceId) return album;

        // Request more detailed song data
        return this.fetchResourceByIdAndType<GeniusAlbumDTO>("album", resourceId).then(async (resource) => {
            // If there is an invalid response (e.g. errors)
            // then return unmodified album object.
            if(!resource) return album;

            // Update metadata
            result.geniusId = resource.id;
            result.description = resource.description_preview;
            result.releasedAt = resource.release_date;

            // TODO: Create publisher and distributor
            // Create label
            const labelResource = resource.performance_groups.find((perf) => perf.label == "Label")?.artists?.[0];
            const label: Label = !labelResource ? null : await this.labelService.createIfNotExists({
                name: labelResource.name,
                geniusId: labelResource.id,
                description: labelResource.description_preview
            }).then(async (result) => {
                return this.artworkService.downloadToBuffer(labelResource.image_url).then((buffer) => {
                    return this.artworkService.createForLabelIfNotExists(result.data, mount, buffer).then((artwork) => {
                        result.data.artwork = artwork;
                        return result.data;
                    })
                })
            }).catch(() => null);



            // Update relations
            result.label = label;

            // If there is an image url present on the resource.
            // Download it and create an artwork for the album
            if(resource.cover_art_thumbnail_url) {
                // Download url to buffer
                return this.artworkService.downloadToBuffer(resource.cover_art_thumbnail_url).then((buffer) => {
                    // Create artwork and write buffer to file
                    return this.artworkService.createForAlbumIfNotExists(album, mount, buffer).then((artwork) => {
                        // Update relation
                        result.artwork = artwork;
                        return result;
                    })
                })
            }

            // If no artwork to download, just return
            return result;
        });
    }

    /**
     * Find song information on genius.com. If found, all information are applied and returned as new artist object.
     * @param song Song to lookup
     * @param mount Mount to use for song's images
     * @returns Song
     */
     public async lookupSong(song: Song, mount: Mount): Promise<Song> {
        const result: Song = Object.assign(new Song(), song);
        const title = song?.name?.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, "").split("-")[0].trim();
        const artist = song.primaryArtist.name;
        const searchQuery = `${title} ${artist}`

        // Get the resource id from given artist object.
        // If the object has no geniusId, try and search a matching id
        // on genius.com. Fail, if this was not possible
        const resourceId = song.geniusId ? song.geniusId : await this.searchResourceIdOfType("song", searchQuery);
        if(!resourceId) return song;

        // Request more detailed song data
        return this.fetchResourceByIdAndType<GeniusSongDTO>("song", resourceId).then(async (resource) => {
            // If there is an invalid response (e.g. errors)
            // then return unmodified artist object.
            if(!resource) return song;

            // Update metadata
            result.geniusId = resource.id;
            result.description = resource.description_preview;
            result.releasedAt = resource.release_date;
            result.explicit = resource.explicit;
            result.location = resource.recording_location;
            result.youtubeUrl = resource.youtube_url;
            result.youtubeUrlStart = resource.youtube_start;

            // TODO: Create publisher and distributor, genres

            // Create label if not exists
            const labelResource = resource.custom_performances.find((perf) => perf.label == "Label")?.artists?.[0];
            const label: Label = !labelResource ? null : await this.labelService.createIfNotExists({
                name: labelResource.name,
                geniusId: labelResource.id,
                description: labelResource.description_preview
            }).then(async (result) => {
                return this.artworkService.downloadToBuffer(labelResource.image_url).then((buffer) => {
                    return this.artworkService.createForLabelIfNotExists(result.data, mount, buffer).then((artwork) => {
                        result.data.artwork = artwork;
                        return result.data;
                    })
                })
            }).catch(() => null);



            // Update relations
            result.label = label;

            // If there is an image url present on the resource.
            // Download it and create an artwork for the artist
            if(resource.song_art_image_thumbnail_url) {
                // Download url to buffer
                return this.artworkService.downloadToBuffer(resource.song_art_image_thumbnail_url).then((buffer) => {
                    // Create artwork and write buffer to file
                    return this.artworkService.createForSongIfNotExists(song, mount, buffer).then((artwork) => {
                        // Update relation
                        result.artwork = artwork;
                        return result;
                    })
                })
            }

            // If no artwork to download, just return
            return result;
        });
    }

    /**
     * Fetch resource information from genius.com by its id and type of resource to fetch
     * @param type Type of resource
     * @param id Id of the resource
     * @returns <T = any>
     */
    protected async fetchResourceByIdAndType<T = any>(type: "song" | "album" | "artist", id: string): Promise<T> {
        const source = axios.CancelToken.source();

        // Timeout request after 10s
        const timeout = setTimeout(() => {
            source.cancel();
        }, 10000);

        // Request the resource by directly accessing the genius api.
        return axios.get<GeniusReponseDTO<T>>(`${GENIUS_API_BASE_URL}/${type}s/${id}`, { cancelToken: source.token }).then(async (response) => {
            // If there is an invalid response (e.g.: errors etc.) then returned unmodified song.
            if(!response || response.data.meta.status != 200 || !response.data.response[type]) return null;

            return response.data.response[type];
        }).finally(() => clearTimeout(timeout))
    }

    /**
     * Fetch a page from the genius search api using a query.
     * @param query Search query
     * @param page Page of search results to fetch
     * @param type Type of resource that is searched
     * @returns GeniusSearchPageResultDTO
     */
    protected searchPage(query: string, page: number, type: "song" | "album" | "artist"): Promise<GeniusSearchPageResultDTO> {
        const source = axios.CancelToken.source();
        const timeout = setTimeout(() => {
            source.cancel();
        }, 30000)
        
        return axios.get<GeniusReponseDTO<GeniusSearchResponse>>(`${GENIUS_API_BASE_URL}/search/${type}?page=${page+1}&q=${encodeURIComponent(query)}`, { cancelToken: source.token }).then((response: AxiosResponse<GeniusReponseDTO<GeniusSearchResponse>>) => {
            if(!response || response.data.meta.status != 200 || !response.data.response.sections) return { result: [], hasNextPage: false };

            // Get matching section of response
            const matchingSection = response.data.response.sections.find((section) => section.type == type);
            if(!matchingSection) return { result: [], hasNextPage: false };

            return { result: matchingSection.hits.map((hit) => hit.result), hasNextPage: !!response.data.response.next_page }
        }).finally(() => clearTimeout(timeout))
    }

    /**
     * Get the geniusId of a resource on genius.com by searching for it.
     * @param type Type of resource
     * @param searchQuery Search query
     * @returns string
     */
    protected async searchResourceIdOfType(type: "song" | "album" | "artist", searchQuery: string): Promise<string> {
        const results: (GeniusArtistDTO | GeniusSongDTO | GeniusAlbumDTO)[] = [];

        for(let i = 0;; i++) {
            const res = await this.searchPage(searchQuery, i, type);
            results.push(...res.result)
            if(!res.hasNextPage) break;
        }

        // Step of optimization:
        // If the name / title of a result matches exactly, the element will be returned.
        const exactMatch = results.find((val) => {
            if(val._type != "song") {
                if(val["name"] == searchQuery) return val;
            } else {
                if(val["title"] == searchQuery) return val;
            }
        })

        if(exactMatch) {
            return exactMatch?.id;
        }

        let bestMatch: { score: number, hit: GeniusArtistDTO | GeniusSongDTO | GeniusAlbumDTO } = { score: 0, hit: null};

        for(const result of results) {
            const string = result._type != "song" ? result["name"] : result["title"]
            const score = Levenshtein.getEditDistance(string, searchQuery);

            if(score <= bestMatch.score || bestMatch.hit == null) {
                bestMatch = { score, hit: result};

                // Step of optimization:
                // Stop this loop if the best possible was found.
                // Thats the case for when the score reaches 0
                if(score <= 0) break;
            }
        }

        return bestMatch.hit?.id;
    }

}