import { MeiliArtist } from "./meili-artist";
import { MeiliArtwork } from "./meili-artwork";

export class MeiliAlbum {
    public id: string;
    public name: string;
    public artist: MeiliArtist;
    public artwork: MeiliArtwork;

    public static attrs() {
        return ["name", "artist.name"]
    }
}