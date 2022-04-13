import { MeiliArtist } from "./meili-artist";
import { MeiliArtwork } from "./meili-artwork";

export class MeiliSong {
    public id: string;
    public name: string;
    public artists: MeiliArtist[];
    public artwork: MeiliArtwork;

    public static attrs() {
        return ["name", "artists.name"]
    }
}