import { IsNotEmpty, IsNumber } from "class-validator";
import { Artist } from "../../artist/entities/artist.entity";

export class CreateSongDTO {

    @IsNotEmpty()
    public title: string;

    @IsNotEmpty()
    @IsNumber()
    public durationInSeconds: number;

    @IsNotEmpty()
    public file: { id: string }

    public artists: Artist[]


}