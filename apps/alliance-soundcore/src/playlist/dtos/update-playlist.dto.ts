import { IsEnum, IsOptional, Length } from "class-validator";
import { PlaylistPrivacy } from "../enums/playlist-privacy.enum";

export class UpdatePlaylistDTO {

    @IsOptional()
    @Length(3, 64)
    public title: string;

    @IsOptional()
    @IsEnum(PlaylistPrivacy)
    public privacy?: PlaylistPrivacy;

}