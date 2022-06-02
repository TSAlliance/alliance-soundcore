import { Mount } from "../../mount/entities/mount.entity";
import { ArtworkType } from "../entities/artwork.entity";

export class CreateArtworkDTO {

    public name: string;
    public mount: Mount;
    public type: ArtworkType = ArtworkType.SONG;
    public writeSource?: string;

}