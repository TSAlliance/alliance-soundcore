import { IsArray, IsNotEmpty } from "class-validator";
import { Song } from "../../song/entities/song.entity";

export class AddSongDTO {

    @IsNotEmpty()
    @IsArray()
    public songs: Song[];

}