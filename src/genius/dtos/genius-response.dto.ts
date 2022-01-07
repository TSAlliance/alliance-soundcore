import { GeniusArtistDTO } from "./genius-artist.dto";
import { GeniusSectionDTO } from "./genius-section.dto";
import { GeniusSongDTO } from "./genius-song.dto";

export type GeniusSearchResponse = { sections: GeniusSectionDTO[] };
export type GeniusSongResponse = { song: GeniusSongDTO };
export type GeniusArtistResponse = { artist: GeniusArtistDTO };

export class GeniusReponseDTO<T> {
    public meta: { status: number };
    public response: T;
}