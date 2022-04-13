import { MeiliArtwork } from "./meili-artwork";

export class MeiliArtist {
    public id: string;
    public name: string;
    public artwork: MeiliArtwork;

    public static attrs() {
        return ["name"]
    }
}