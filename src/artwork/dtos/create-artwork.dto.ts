import { IsOptional } from "class-validator";
import { ArtworkType } from "../types/artwork-type.enum";

export class CreateArtworkDTO {

    public type: ArtworkType;

    @IsOptional()
    public url?: string;

    @IsOptional()
    public mountId?: string;

    @IsOptional()
    public autoDownload?: boolean;

}