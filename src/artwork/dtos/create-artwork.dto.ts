import { IsNotEmpty, IsOptional, Length } from "class-validator";
import { ArtworkType } from "../types/artwork-type.enum";

export class CreateArtworkDTO {

    public type: ArtworkType;

    @IsNotEmpty()
    @Length(3, 254)
    public dstFilename: string;

    @IsOptional()
    public url?: string;

    @IsOptional()
    public mountId?: string;

    @IsOptional()
    public autoDownload?: boolean;

}