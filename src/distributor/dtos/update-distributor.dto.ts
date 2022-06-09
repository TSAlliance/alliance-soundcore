import { IsNotEmpty, IsOptional, Length } from "class-validator";
import { Artwork } from "../../artwork/entities/artwork.entity";

export class UpdateDistributorDTO {

    @IsNotEmpty()
    @Length(3, 254)
    public name: string;

    @IsOptional()
    public geniusId?: string;

    @IsOptional()
    public description?: string;

    @IsOptional()
    public artwork?: Artwork;

}