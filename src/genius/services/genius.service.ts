import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { ArtworkService } from '../../artwork/artwork.service';
import { DistributorService } from '../../distributor/distributor.service';
import { LabelService } from '../../label/label.service';
import { PublisherService } from '../../publisher/publisher.service';
import { Song } from '../../song/entities/song.entity';
import { GeniusReponseDTO, GeniusSearchResponse, GeniusSongResponse } from '../dtos/genius-response.dto';
import { GeniusSongDTO } from '../dtos/genius-song.dto';

const GENIUS_BASE_URL = "https://genius.com/api"

@Injectable()
export class GeniusService {
    private logger: Logger = new Logger(GeniusService.name);

    constructor(
        private publisherService: PublisherService,
        private distributorService: DistributorService,
        private labelService: LabelService,
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

                song.api_path = result.api_path;
                song.geniusId = result.id;
                song.geniusUrl = result.url;
                song.banner = await this.artworkService.create({ autoDownload: true, type: "banner", mountId: song.index.mount.id, url: result.header_image_url });
                song.location = result.recording_location;
                song.released = result.release_date;
                song.youtubeUrl = result.youtube_url;
                song.youtubeUrlStart = result.youtube_start;
                song.explicit = result.explicit;

                // If there is no existing artwork on the song, then
                // take the url (if exists) from Genius.com and apply
                // as the new artwork
                if(!song.artwork && result.song_art_image_thumbnail_url) {
                    const artwork = await this.artworkService.create({ 
                        type: "song",
                        autoDownload: true,
                        mountId: song.index.mount.id,
                        url: result.song_art_image_thumbnail_url 
                    });
                    if(artwork) song.artwork = artwork
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
