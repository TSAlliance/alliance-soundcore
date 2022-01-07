import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { Album } from '../../album/entities/album.entity';
import { Artist } from '../../artist/entities/artist.entity';
import { ArtworkService } from '../../artwork/artwork.service';
import { Mount } from '../../bucket/entities/mount.entity';
import { DistributorService } from '../../distributor/distributor.service';
import { GenreService } from '../../genre/genre.service';
import { LabelService } from '../../label/label.service';
import { PublisherService } from '../../publisher/publisher.service';
import { Song } from '../../song/entities/song.entity';
import { GeniusAlbumDTO } from '../dtos/genius-album.dto';
import { GeniusArtistDTO } from '../dtos/genius-artist.dto';
import { GeniusArtistResponse, GeniusReponseDTO, GeniusSearchResponse } from '../dtos/genius-response.dto';
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
        private genreService: GenreService
    ) {}

    public async findAndApplySongInfo(song: Song): Promise<Song> {
        const title = song.title.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, "").split("-")[0];
        const artists = song.artists[0]?.name || "";
        const params = new URLSearchParams();

        if(artists != "") {
            params.append("q", title + " " + artists)
        } else {
            params.append("q", song.title)
        }

        return this.searchResourceIdOfType("song", params).then((resourceId) => {
            if(!resourceId) return song;

            // Request more detailed song data
            return this.fetchResourceByIdAndType<GeniusSongDTO>("song", resourceId).then(async (songDto) => {
                if(!songDto) return song;

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

                song.api_path = songDto.api_path;
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

                return song;
            }).catch((error) => {
                this.logger.warn("Error occured when searching for song info on Genius.com: ");
                console.error(error)
                return song;
            })
        }).catch((error) => {
            this.logger.warn("Error occured when searching for song info on Genius.com: ");
            console.error(error)
            return song;
        })
    }

    public async findAndApplyAlbumInfo(album: Album, mountForArtworkId?: string): Promise<Album> {
        const params = new URLSearchParams();
        const title = album.title.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, "").split("-")[0];

        if(album.artists && album.artists.length > 0) {
            params.append("q", `${title} ${album.artists[0].name}`)
        } else {
            params.append("q", `${title}`)
        }

        console.log(params)

        // First search for the resource id
        return this.searchResourceIdOfType("album", params).then((resourceId) => {
            if(!resourceId) return album;

            // Request more detailed song data
            return this.fetchResourceByIdAndType<GeniusAlbumDTO>("album", resourceId).then(async (albumDto) => {

                // Create distributor if not exists
                const distributorResult = albumDto.performance_groups.find((perf) => perf.label == "Distributor");
                if(distributorResult) {
                    const distributor = await this.distributorService.createIfNotExists({ name: distributorResult.artists[0].name, geniusId: distributorResult.artists[0].id, externalImgUrl: distributorResult.artists[0].image_url })
                    if(distributor) album.distributor = distributor;
                }

                // Create publisher if not exists
                const publisherResult = albumDto.performance_groups.find((perf) => perf.label == "Publisher");
                if(publisherResult) {
                    const publisher = await this.publisherService.createIfNotExists({ name: publisherResult.artists[0].name, geniusId: publisherResult.artists[0].id, externalImgUrl: publisherResult.artists[0].image_url })
                    if(publisher) album.publisher = publisher;
                }

                // Create label if not exists
                const labelResult = albumDto.performance_groups.find((perf) => perf.label == "Label");
                if(labelResult) {
                    const label = await this.labelService.createIfNotExists({ name: labelResult.artists[0].name, geniusId: labelResult.artists[0].id, externalImgUrl: labelResult.artists[0].image_url })
                    if(label) album.label = label;
                }

                album.title = albumDto.name;
                album.banner = await this.artworkService.create({ type: "banner_album", autoDownload: true, dstFilename: album.title, url: albumDto.header_image_url, mountId: mountForArtworkId })
                album.artwork = await this.artworkService.create({ type: "album", autoDownload: true, dstFilename: album.title, url: albumDto.cover_art_thumbnail_url, mountId: mountForArtworkId })
                album.geniusId = albumDto.id;
                album.released = albumDto.release_date;

                return album;
            }).catch((error) => {
                this.logger.warn("Error occured when searching for album info on Genius.com: ");
                console.error(error)
                return album;
            })
        }).catch((error) => {
            this.logger.warn("Error occured when searching for album info on Genius.com: ");
            console.error(error)
            return album;
        })
    }

    /**
     * Find artist information on genius.com. If found, all information are applied and returned as new artist object.
     * @param artist Artist to lookup
     * @returns Artist
     */
    public async findAndApplyArtistInfo(artist: Artist, mountForArtwork?: Mount): Promise<Artist> {
        const params = new URLSearchParams();
        params.append("q", artist.name)

        // First search for the resource id
        return this.searchResourceIdOfType("artist", params).then((resourceId) => {
            if(!resourceId) return artist;

            // Request more detailed song data
            return this.fetchResourceByIdAndType<GeniusArtistDTO>("artist", resourceId).then(async (artistDto) => {
                // If there is an invalid response (e.g.: errors etc.) then returned unmodified song.
                if(!artistDto) return artist;

                artist.api_path = artistDto.api_path;
                artist.geniusId = artistDto.id;
                artist.geniusUrl = artistDto.url;
                artist.banner = await this.artworkService.create({ autoDownload: true, type: "banner_artist", url: artistDto.header_image_url, dstFilename: artist.name, mountId: mountForArtwork?.id || undefined });
                artist.description = artistDto.description_preview

                // If there is no existing artwork on the song, then
                // take the url (if exists) from Genius.com and apply
                // as the new artwork
                if(artistDto.image_url) {
                    const artwork = await this.artworkService.create({ 
                        type: "artist",
                        autoDownload: true,
                        url: artistDto.image_url,
                        dstFilename: artist.name,
                        mountId: mountForArtwork?.id || undefined
                    });
                    if(artwork) artist.artwork = artwork
                }

                return artist;
            }).catch((error) => {
                this.logger.warn("Error occured when searching for artist info on Genius.com: ");
                console.error(error)
                return artist;
            })
        }).catch((error) => {
            this.logger.warn("Error occured when searching for artist info on Genius.com: ");
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
    private searchResourceIdOfType(type: "song" | "album" | "artist", searchQuery: string | URLSearchParams): Promise<string> {
        return axios.get<GeniusReponseDTO<GeniusSearchResponse>>(`${GENIUS_BASE_URL}/search/${type}?${searchQuery}`).then((response: AxiosResponse<GeniusReponseDTO<GeniusSearchResponse>>) => {
            if(!response || response.data.meta.status != 200 || !response.data.response.sections) return null;

            // Get matching section of response
            const matchingSection = response.data.response.sections.find((section) => section.type == type);
            if(!matchingSection) return null;

            // Get best hit from the hits array.
            // If nothing was found, take the first element from the hits array.
            const searchHit = matchingSection.hits.find((hit) => hit.type == "top_hit") || matchingSection.hits[0];
            if(!searchHit || searchHit.type != type) return null;

            // Get song entry from hit object
            const geniusSearchResult = searchHit.result;
            if(!geniusSearchResult) return null;

            return geniusSearchResult.id
        })
    }

    /**
     * Fetch resource information from genius.com by its id and type of resource to fetch
     * @param type Type of resource
     * @param id Id of the resource
     * @returns <T>
     */
    private async fetchResourceByIdAndType<T>(type: "song" | "album" | "artist", id: string): Promise<T> {
        return axios.get<GeniusReponseDTO<GeniusArtistResponse>>(`${GENIUS_BASE_URL}/${type}s/${id}`).then(async (response) => {
            // If there is an invalid response (e.g.: errors etc.) then returned unmodified song.
            if(!response || response.data.meta.status != 200 || !response.data.response[type]) return null;

            return response.data.response[type];
        })
    }

}
