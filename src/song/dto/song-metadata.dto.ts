import { Artist } from "../../artist/entities/artist.entity";

export class SongMetadataDTO {
    public title: string;
    public durationInSeconds: number;
    public artists: Artist[];
    public artworkBuffer: Promise<Buffer>
    
}