import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { Artist } from '../../artist/entities/artist.entity';
import { ArtworkService } from '../../artwork/artwork.service';
import { Mount } from '../../bucket/entities/mount.entity';
import { DistributorService } from '../../distributor/distributor.service';
import { GenreService } from '../../genre/genre.service';
import { LabelService } from '../../label/label.service';
import { PublisherService } from '../../publisher/publisher.service';
import { Song } from '../../song/entities/song.entity';
import { GeniusArtistResponse, GeniusReponseDTO, GeniusSearchResponse, GeniusSongResponse } from '../dtos/genius-response.dto';
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

        return axios.get<GeniusReponseDTO<GeniusSearchResponse>>(`${GENIUS_BASE_URL}/search/song?${params}`).then(async(response: AxiosResponse<GeniusReponseDTO<GeniusSearchResponse>>) => {
            if(!response || response.data.meta.status != 200 || !response.data.response.sections) return song;

            // Get song section of response
            const songSection = response.data.response.sections.find((section) => section.type == "song");
            
            if(!songSection) return song;

            // Get best hit from the hits array.
            // If nothing was found, take the first element from the hits array.
            const searchHit = songSection.hits.find((hit) => hit.type == "top_hit") || songSection.hits[0];
            if(!searchHit || searchHit.type != "song") return song;

            // Get song entry from hit object
            const geniusSearchSong = searchHit.result as GeniusSongDTO;
            if(!geniusSearchSong) return song;

            // Get api path to request more detailed song data
            const songApiPath = `/songs/${geniusSearchSong.id}`

            // Request more detailed song data // { headers: { "Authorization": `Bearer ${process.env.GENIUS_TOKEN}` }}
            return axios.get<GeniusReponseDTO<GeniusSongResponse>>(`${GENIUS_BASE_URL}${songApiPath}`).then(async (response) => {
                // If there is an invalid response (e.g.: errors etc.) then returned unmodified song.
                if(!response || response.data.meta.status != 200 || !response.data.response.song) return song;

                const result = response.data.response.song;
                if(!result) return song;

                // Create distributor if not exists
                const distributorResult = result.custom_performances.find((perf) => perf.label == "Distributor");
                if(distributorResult) {
                    const distributor = await this.distributorService.createIfNotExists({ name: distributorResult.artists[0].name, geniusId: distributorResult.artists[0].id, externalImgUrl: distributorResult.artists[0].image_url })
                    if(distributor) song.distributor = distributor;
                }

                // Create publisher if not exists
                const publisherResult = result.custom_performances.find((perf) => perf.label == "Publisher");
                if(publisherResult) {
                    const publisher = await this.publisherService.createIfNotExists({ name: publisherResult.artists[0].name, geniusId: publisherResult.artists[0].id, externalImgUrl: publisherResult.artists[0].image_url })
                    if(publisher) song.publisher = publisher;
                }

                // Create label if not exists
                const labelResult = result.custom_performances.find((perf) => perf.label == "Label");
                if(labelResult) {
                    const label = await this.labelService.createIfNotExists({ name: labelResult.artists[0].name, geniusId: labelResult.artists[0].id, externalImgUrl: labelResult.artists[0].image_url })
                    if(label) song.label = label;
                }

                // Create genres if not existing
                const genres = result.tags
                if(genres) {
                    song.genres = [];

                    for(const genreDto of genres) {
                        const result = await this.genreService.createIfNotExists({ name: genreDto.name, geniusId: genreDto.id })
                        song.genres.push(result);
                    }
                }

                song.api_path = result.api_path;
                song.geniusId = result.id;
                song.geniusUrl = result.url;
                song.banner = await this.artworkService.create({ autoDownload: true, type: "banner_song", mountId: song.index.mount.id, url: result.header_image_url, dstFilename: song.index.filename });
                song.location = result.recording_location;
                song.released = result.release_date;
                song.youtubeUrl = result.youtube_url;
                song.youtubeUrlStart = result.youtube_start;
                song.explicit = result.explicit;
                song.description = result.description_preview;

                // If there is no existing artwork on the song, then
                // take the url (if exists) from Genius.com and apply
                // as the new artwork
                if(!song.artwork && result.song_art_image_thumbnail_url) {
                    const artwork = await this.artworkService.create({ 
                        type: "song",
                        autoDownload: true,
                        mountId: song.index.mount.id,
                        url: result.song_art_image_thumbnail_url,
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

    /**
     * Find artist information on genius.com. If found, all information are applied and returned as new artist object.
     * @param artist Artist to lookup
     * @returns Artist
     */
    public async findAndApplyArtistInfo(artist: Artist, mountForArtwork?: Mount): Promise<Artist> {
        const params = new URLSearchParams();
        params.append("q", artist.name)

        return axios.get<GeniusReponseDTO<GeniusSearchResponse>>(`${GENIUS_BASE_URL}/search/artist?${params}`).then(async(response: AxiosResponse<GeniusReponseDTO<GeniusSearchResponse>>) => {
            if(!response || response.data.meta.status != 200 || !response.data.response.sections) return artist;

            // Get artist section of response
            const artistSection = response.data.response.sections.find((section) => section.type == "artist");
            
            if(!artistSection) return artist;

            // Get best hit from the hits array.
            // If nothing was found, take the first element from the hits array.
            const searchHit = artistSection.hits.find((hit) => hit.type == "top_hit") || artistSection.hits[0];
            if(!searchHit || searchHit.type != "artist") return artist;

            // Get song entry from hit object
            const geniusSearchArtist = searchHit.result as GeniusSongDTO;
            if(!geniusSearchArtist) return artist;

            // Get api path to request more detailed song data
            const artistApiPath = `/artists/${geniusSearchArtist.id}`

            // Request more detailed song data // { headers: { "Authorization": `Bearer ${process.env.GENIUS_TOKEN}` }}
            return axios.get<GeniusReponseDTO<GeniusArtistResponse>>(`${GENIUS_BASE_URL}${artistApiPath}`).then(async (response) => {
                // If there is an invalid response (e.g.: errors etc.) then returned unmodified song.
                if(!response || response.data.meta.status != 200 || !response.data.response.artist) return artist;

                const result = response.data.response.artist;
                if(!result) return artist;

                artist.api_path = result.api_path;
                artist.geniusId = result.id;
                artist.geniusUrl = result.url;
                artist.banner = await this.artworkService.create({ autoDownload: true, type: "banner_artist", url: result.header_image_url, dstFilename: artist.name, mountId: mountForArtwork?.id || undefined });
                artist.description = result.description_preview

                // If there is no existing artwork on the song, then
                // take the url (if exists) from Genius.com and apply
                // as the new artwork
                if(result.image_url) {
                    const artwork = await this.artworkService.create({ 
                        type: "artist",
                        autoDownload: true,
                        url: result.image_url,
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

}
