import { GeniusSectionDTO } from "./genius-section.dto";
import { GeniusSongDTO } from "./genius-song.dto";

export type GeniusSearchResponse = { sections: GeniusSectionDTO[] };
export type GeniusSongResponse = { song: GeniusSongDTO };

export class GeniusReponseDTO<T> {
    public meta: { status: number };
    public response: T;
}