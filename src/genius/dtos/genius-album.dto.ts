import { GeniusType } from "../enums/genius-type.enum";
import { GeniusArtistDTO } from "./genius-artist.dto";

export class GeniusAlbumOld {

    public geniusId?: string;
    public coverUrl?: string;


}

export class GeniusAlbumDTO {

    public id: string;
    public name: string;
    public url: string;
    public _type: GeniusType;
    public cover_art_thumbnail_url: string;
    public artist: GeniusArtistDTO;

}