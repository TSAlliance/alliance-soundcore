import { ArtworkType } from "../enums/artwork-type.enum";

export class CreateArtworkDTO {

    public type: ArtworkType;
    public foreignResourceId: string;
    public buffer: Promise<Buffer>;

}