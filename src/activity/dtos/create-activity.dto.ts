import { IsNotEmptyObject, IsObject, IsOptional } from "class-validator";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { Song } from "../../song/entities/song.entity";

export class CreateActivityDTO {

    @IsNotEmptyObject()
    public song: Song;

    @IsOptional()
    @IsObject()
    public playlist: Playlist;

}