import { IsEnum, IsNotEmpty, IsOptional, Length } from "class-validator";
import { PlaylistPrivacy } from "../enums/playlist-privacy.enum";

export class CreatePlaylistDTO {

    @IsNotEmpty()
    @Length(3, 64)
    public title: string;

    @IsOptional()
    @Length(0, 254)
    public description?: string;

    @IsOptional()
    @IsEnum(PlaylistPrivacy)
    public privacy?: PlaylistPrivacy;

    @IsOptional()
    public collaborative?: boolean;

    @IsOptional()
    public collaborators?: { id: string }[];

    @IsOptional()
    public songs?: { id: string }[];

}