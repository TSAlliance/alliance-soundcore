import { GeniusAlbum } from "./genius-album.dto";

export class GeniusSongDTO {

    public geniusId?: string;
    public recordingLocation?: string;
    public releaseDate?: Date;
    public youtubeUrl?: string;
    public publisher?: { name: string, id: string };
    public label?: { name: string, id: string };
    public album?: GeniusAlbum;

}