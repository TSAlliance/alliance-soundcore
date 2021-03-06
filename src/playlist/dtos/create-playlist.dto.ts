import { IsEnum, IsNotEmpty, IsOptional, Length } from "class-validator";
import { PlaylistPrivacy } from "../enums/playlist-privacy.enum";

export class CreatePlaylistDTO {

    @IsNotEmpty()
    @Length(3, 64)
    public title: string;

    @IsOptional()
    @IsEnum(PlaylistPrivacy)
    public privacy?: PlaylistPrivacy;

}