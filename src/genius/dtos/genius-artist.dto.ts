import { GeniusType } from "../enums/genius-type.enum";

export class GeniusArtistDTO {

    public id: string;
    public api_path: string;
    public _type: GeniusType;
    public header_image_url: string;
    public image_url: string;
    public name: string;
    public url: string;

}