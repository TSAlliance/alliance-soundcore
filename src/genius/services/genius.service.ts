import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { ArtworkService } from '../../artwork/artwork.service';
import { Song } from '../../song/entities/song.entity';
import { GeniusReponseDTO, GeniusSearchResponse, GeniusSongResponse } from '../dtos/genius-response.dto';
import { GeniusSongDTO } from '../dtos/genius-song.dto';

const GENIUS_BASE_URL = "https://genius.com/api"

@Injectable()
export class GeniusService {
    private logger: Logger = new Logger(GeniusService.name);

    constructor(
        private artworkService: ArtworkService
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

        this.logger.debug("Searching song on Genius.com using query: " + params)

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

                song.api_path = result.api_path;
                song.geniusId = result.id;
                song.geniusUrl = result.url;
                song.header_image_url = result.header_image_url;
                song.location = result.recording_location;
                song.released = result.release_date;
                song.youtubeUrl = result.youtube_url;
                song.youtubeUrlStart = result.youtube_start;
                song.explicit = result.explicit;

                // If there is no existing artwork on the song, then
                // take the url (if exists) from Genius.com and apply
                // as the new artwork
                if(!song.artwork && result.song_art_image_thumbnail_url) {
                    song.artwork = await this.artworkService.createExternalForIndex(song.index, { url: result.song_art_image_thumbnail_url })
                }

                song.description = result.description_preview;

                return song;
            }).catch((error) => {
                this.logger.warn("Error occured when searching for song info on Genius.com: ");
                this.logger.error(error);
                return song;
            })
        }).catch((error) => {
            this.logger.warn("Error occured when searching for song info on Genius.com: ");
            this.logger.error(error);
            return song;
        })
    }

}
