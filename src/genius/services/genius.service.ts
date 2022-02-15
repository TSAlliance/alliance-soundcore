import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { Album } from '../../album/entities/album.entity';
import { Artist } from '../../artist/entities/artist.entity';
import { ArtworkService } from '../../artwork/artwork.service';
import { DistributorService } from '../../distributor/distributor.service';
import { GenreService } from '../../genre/genre.service';
import { LabelService } from '../../label/label.service';
import { PublisherService } from '../../publisher/publisher.service';
import { Song } from '../../song/entities/song.entity';
import { Levenshtein } from '../../utils/levenshtein';
import { GeniusAlbumDTO } from '../dtos/genius-album.dto';
import { GeniusArtistDTO } from '../dtos/genius-artist.dto';
import { GeniusReponseDTO, GeniusSearchResponse } from '../dtos/genius-response.dto';
import { GeniusSongDTO } from '../dtos/genius-song.dto';

const GENIUS_BASE_URL = "https://genius.com/api"

@Injectable()
export class GeniusService {
    private logger: Logger = new Logger(GeniusService.name);

    constructor(
        private publisherService: PublisherService,
        private distributorService: DistributorService,
        private labelService: LabelService,
        private artworkService: ArtworkService,
        private genreService: GenreService,
    ) {}

    public async findAndApplySongInfo(song: Song): Promise<{ song: Song, dto?: GeniusSongDTO }> {
        const title = song?.title?.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, "").split("-")[0];
        const artists = song.artists[0]?.name || "";
        let query: string;

        if(!title) {
            console.warn("Found a song without title: ", song.index.filename)
            return { song, dto: null };
        }

        if(artists != "") {
            query = title + " " + artists
        } else {
            query = song.title
        }

        return this.searchResourceIdOfType("song", query).then((resourceId) => {
            if(!resourceId) return { song };

            // Request more detailed song data
            return this.fetchResourceByIdAndType<GeniusSongDTO>("song", resourceId).then(async (songDto) => {
                if(!songDto) return { song };

                // Create distributor if not exists
                const distributorResult = songDto.custom_performances.find((perf) => perf.label == "Distributor");
                if(distributorResult) {
                    const distributor = await this.distributorService.createIfNotExists({ name: distributorResult.artists[0].name, geniusId: distributorResult.artists[0].id, externalImgUrl: distributorResult.artists[0].image_url })
                    if(distributor) song.distributor = distributor;
                }

                // Create publisher if not exists
                const publisherResult = songDto.custom_performances.find((perf) => perf.label == "Publisher");
                if(publisherResult) {
                    const publisher = await this.publisherService.createIfNotExists({ name: publisherResult.artists[0].name, geniusId: publisherResult.artists[0].id, externalImgUrl: publisherResult.artists[0].image_url })
                    if(publisher) song.publisher = publisher;
                }

                // Create label if not exists
                const labelResult = songDto.custom_performances.find((perf) => perf.label == "Label");
                if(labelResult) {
                    const label = await this.labelService.createIfNotExists({ name: labelResult.artists[0].name, geniusId: labelResult.artists[0].id, externalImgUrl: labelResult.artists[0].image_url })
                    if(label) song.label = label;
                }

                // Create genres if not existing
                const genres = songDto.tags
                if(genres) {
                    song.genres = [];

                    for(const genreDto of genres) {
                        const result = await this.genreService.createIfNotExists({ name: genreDto.name, geniusId: genreDto.id })
                        song.genres.push(result);
                    }
                }

                song.geniusId = songDto.id;
                song.geniusUrl = songDto.url;
                song.banner = await this.artworkService.create({ autoDownload: true, type: "banner_song", mountId: song.index.mount.id, url: songDto.header_image_url, dstFilename: song.index.filename });
                song.location = songDto.recording_location;
                song.released = songDto.release_date;
                song.youtubeUrl = songDto.youtube_url;
                song.youtubeUrlStart = songDto.youtube_start;
                song.explicit = songDto.explicit;
                song.description = songDto.description_preview;

                // If there is no existing artwork on the song, then
                // take the url (if exists) from Genius.com and apply
                // as the new artwork
                if(!song.artwork && songDto.song_art_image_thumbnail_url) {
                    const artwork = await this.artworkService.create({ 
                        type: "song",
                        autoDownload: true,
                        mountId: song.index.mount.id,
                        url: songDto.song_art_image_thumbnail_url,
                        dstFilename: song.index.filename
                    });
                    if(artwork) song.artwork = artwork
                }

                return { song, dto: songDto };
            }).catch((error) => {
                this.logger.warn("Error occured when searching for song info on Genius.com: ");
                console.error(error)
                throw error;
            })
        }).catch((error) => {
            this.logger.warn("Error occured when searching for song info on Genius.com: ");
            console.error(error)
            throw error;
        })
    }

    /**
     * Search for an album by its name and primary artist's name on genius.com. If found
     * all the information is set to the album object.
     * This will apply info about release data, description, header image, cover image, label,
     * distributor, publisher and the id on genius.com
     * @param album Album to be searched
     * @param firstArtistName Primary artist's name
     * @param mountForArtwork Mount for possible artworks that could be created during the process
     * @returns Album
     */
    public async findAndApplyAlbumInfo(album: Album, artists: Artist[], mountForArtwork?: string): Promise<{ album: Album, artist: GeniusArtistDTO }> {
        if(!album?.title) return;

        const artistsWithGeniusIds: string[] = artists.filter((a) => !!a.geniusId).map((a) => a.geniusId);
        const artistsWithoutGeniusIdnames: string[] = artists.map((a) => a.name);

        // Search album on genius.com
        // This looks up around 80 albums and checks if the titles match together if the primaryArtist equals one of the provided artists.
        const albums: GeniusAlbumDTO[] = []

        // Get list of albums by a title
        for(let i = 0; i < 8; i++) {
            const res = (await this.searchPage(i, "album", album?.title?.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, "").split("-")[0]));
            albums.push(...res.result as GeniusAlbumDTO[])
            if(!res.hasNextPage) break;
        }

        // Filter albums that contain one of the artists as primary artist
        const filteredExactAlbums = albums.filter((a) => a.name == album.title && (artistsWithGeniusIds.includes(a.artist.id) || artistsWithoutGeniusIdnames.includes(a.artist.name)))
        let bestMatch: { score: number, hit: GeniusAlbumDTO } = { score: 0, hit: null};

        for(const result of filteredExactAlbums) {
            const score = Levenshtein.getEditDistance(result.name, album.title);

            if(score <= bestMatch.score || bestMatch.hit == null) {
                bestMatch = { score, hit: result};

                // Step of optimization:
                // Stop this loop if the best possible was found.
                // Thats the case for when the score reaches 0
                if(score <= 0) break;
            }
        }
        
        if(!bestMatch || !bestMatch.hit || !bestMatch.hit.id) {
            return { album, artist: null };
        }
        
        return await this.fetchResourceByIdAndType<GeniusAlbumDTO>("album", bestMatch.hit.id).then(async (albumDto) => {
            if(!albumDto) return { album, artist: null };

            // Create distributor if not exists
            const distributorResult = albumDto.performance_groups.find((perf) => perf.label == "Distributor");
            if(distributorResult) {
                const distributor = await this.distributorService.createIfNotExists({ name: distributorResult.artists[0].name, geniusId: distributorResult.artists[0].id, externalImgUrl: distributorResult.artists[0].image_url, artworkMountId: mountForArtwork })
                if(distributor) album.distributor = distributor;
            }

            // Create publisher if not exists
            const publisherResult = albumDto.performance_groups.find((perf) => perf.label == "Publisher");
            if(publisherResult) {
                const publisher = await this.publisherService.createIfNotExists({ name: publisherResult.artists[0].name, geniusId: publisherResult.artists[0].id, externalImgUrl: publisherResult.artists[0].image_url, artworkMountId: mountForArtwork })
                if(publisher) album.publisher = publisher;
            }

            // Create label if not exists
            const labelResult = albumDto.performance_groups.find((perf) => perf.label == "Label");
            if(labelResult) {
                const label = await this.labelService.createIfNotExists({ name: labelResult.artists[0].name, geniusId: labelResult.artists[0].id, externalImgUrl: labelResult.artists[0].image_url, artworkMountId: mountForArtwork })
                if(label) album.label = label;
            }

            album.banner = await this.artworkService.create({ type: "banner_album", autoDownload: true, dstFilename: album.title, url: albumDto.header_image_url, mountId: mountForArtwork })
            album.artwork = await this.artworkService.create({ type: "album", autoDownload: true, dstFilename: album.title, url: albumDto.cover_art_thumbnail_url, mountId: mountForArtwork })
            album.geniusId = albumDto.id;
            album.released = albumDto.release_date;
            album.description = albumDto.description_preview;

            return { album, artist: albumDto.artist };
        }).catch((error) => {
            this.logger.warn("Error occured when searching for album info on Genius.com: ", error);
            console.error(error)
            return { album, artist: null };
        })
    }

    /**
     * Find artist information on genius.com. If found, all information are applied and returned as new artist object.
     * @param artist Artist to lookup
     * @returns Artist
     */
    public async findAndApplyArtistInfo(artist: Artist, mountForArtworkId?: string): Promise<Artist> {

        // First search for the resource id
        const resourceId = artist.geniusId ? artist.geniusId : await this.searchResourceIdOfType("artist", artist.name).catch((error) => {
            this.logger.warn("Error occured when searching for artist info on Genius.com: " + error.message);
            console.error(error)
            return null;
        })

        if(!resourceId) return artist;

        // Request more detailed song data
        return this.fetchResourceByIdAndType<GeniusArtistDTO>("artist", resourceId).then(async (artistDto) => {
            // If there is an invalid response (e.g.: errors etc.) then returned unmodified song.
            if(!artistDto) return artist;

            artist.geniusId = artistDto.id;
            artist.geniusUrl = artistDto.url;
            artist.description = artistDto.description_preview

            // Create banner image locally by enabling autoDownload
            artist.banner = await this.artworkService.create({ 
                autoDownload: true, 
                type: "banner_artist", 
                url: artistDto.header_image_url, 
                dstFilename: artist.name, 
                mountId: mountForArtworkId || undefined 
            });

            // If there is no existing artwork on the song, then
            // take the url (if exists) from Genius.com and apply
            // as the new artwork
            if(artistDto.image_url) {
                const artwork = await this.artworkService.create({ 
                    type: "artist",
                    autoDownload: true,
                    url: artistDto.image_url,
                    dstFilename: artist.name,
                    mountId: mountForArtworkId || undefined
                });
                if(artwork) artist.artwork = artwork
            }

            return artist;
        }).catch((error) => {
            this.logger.warn("Error occured when fetching resource for artist from Genius.com using id '" + resourceId + "': " + error.message);
            console.error(error)
            return artist;
        })
    }

    /**
     * Get the geniusId of a resource on genius.com by searching for it.
     * @param type Type of resource
     * @param searchQuery Search query
     * @returns string
     */
    private async searchResourceIdOfType(type: "song" | "album" | "artist", searchQuery: string): Promise<string> {
        const results: (GeniusArtistDTO | GeniusSongDTO | GeniusAlbumDTO)[] = [];

        for(let i = 0; i < 8; i++) {
            const res = await this.searchPage(i, type, searchQuery);
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

    private searchPage(page: number, type: "song" | "album" | "artist", query: string): Promise<{ result: (GeniusArtistDTO | GeniusSongDTO | GeniusAlbumDTO)[], hasNextPage: boolean }> {
        return axios.get<GeniusReponseDTO<GeniusSearchResponse>>(`${GENIUS_BASE_URL}/search/${type}?page=${page+1}&q=${encodeURIComponent(query)}`).then((response: AxiosResponse<GeniusReponseDTO<GeniusSearchResponse>>) => {
            if(!response || response.data.meta.status != 200 || !response.data.response.sections) return { result: [], hasNextPage: false };

            // Get matching section of response
            const matchingSection = response.data.response.sections.find((section) => section.type == type);
            if(!matchingSection) return { result: [], hasNextPage: false };

            return { result: matchingSection.hits.map((hit) => hit.result), hasNextPage: !!response.data.response.next_page }
        }).catch((error: AxiosError) => {
            if(error.response) {
                if(error.response.status == 403) {
                    this.logger.warn(`Searching resource page (${page}, ${type}) failed: Request blocked or forbidden.`)
                } else {
                    this.logger.warn(`Searching resource page (${page}, ${type}) failed: ${error.response.statusText}`)
                    console.error(error.response.data);
                }
            } else {
                this.logger.warn(`Searching resource page (${page}, ${type}) failed:`, error)
            }

            return { result: [], hasNextPage: false };
        })
    }

    /**
     * Fetch resource information from genius.com by its id and type of resource to fetch
     * @param type Type of resource
     * @param id Id of the resource
     * @returns <T>
     */
    public async fetchResourceByIdAndType<T>(type: "song" | "album" | "artist", id: string): Promise<T> {
        return axios.get<GeniusReponseDTO<T>>(`${GENIUS_BASE_URL}/${type}s/${id}`).then(async (response) => {
            // If there is an invalid response (e.g.: errors etc.) then returned unmodified song.
            if(!response || response.data.meta.status != 200 || !response.data.response[type]) return null;

            return response.data.response[type];
        })
    }

}
