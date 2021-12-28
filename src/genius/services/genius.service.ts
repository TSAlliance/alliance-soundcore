import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Song } from '../../song/entities/song.entity';
import { GeniusSongDTO } from '../dtos/genius-song.dto';

const GENIUS_BASE_URL = "https://api.genius.com"

@Injectable()
export class GeniusService {

    public async findSongInfo(song: Song): Promise<GeniusSongDTO> {
        const title = song.title.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, "").split("-")[0];
        const artists = song.artists[0]?.name || "";

        const params = new URLSearchParams();
        params.append("q", title + " " + artists)

        return axios.get(`${GENIUS_BASE_URL}/search?${params}`, { headers: { "Authorization": `Bearer ${process.env.GENIUS_TOKEN}` } }).catch(() => null).then(async(response) => {
            if(!response || response.data["meta"]["status"] != 200) return null;

            const searchHit = response.data["response"]["hits"][0]["result"];
            if(!searchHit) return null;
            const geniusSongPath = searchHit["api_path"];
            if(!geniusSongPath) return null;

            return axios.get(`${GENIUS_BASE_URL}${geniusSongPath}`, { headers: { "Authorization": `Bearer ${process.env.GENIUS_TOKEN}` }}).catch(() => null).then((response) => {
                if(!response || response.data["meta"]["status"] != 200) return null;

                const result = response.data["response"]["song"];
                if(!searchHit) return null;

                const label = result["custom_performances"]?.find((performance) => performance["label"] == "Label")
                const publisher = result["custom_performances"]?.find((performance) => performance["label"] == "Distributor")
                const youtubeProvider = result["media"]?.find((media) => media["provider"] == "youtube")
                const album = result["album"] ? { geniusId: result["album"]["id"], coverUrl: result["album"]["cover_art_url"] } : undefined
               
                return {
                    geniusId: result["id"],
                    recordingLocation: result["recording_location"],
                    releaseDate: result["release_date"] ? new Date(result["release_date"]) : undefined,
                    label: label && label["artists"][0]?.name ? { name: label["artists"][0]?.name, id: label["artists"][0]?.id } : undefined,
                    publisher: publisher && publisher["artists"][0]?.name ? { name: publisher["artists"][0]?.name, id: publisher["artists"][0]?.id } : undefined,
                    youtubeUrl: youtubeProvider ? youtubeProvider["url"] : undefined,
                    album
                }
            })
        })
    }

}
