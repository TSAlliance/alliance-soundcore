import { IsNotEmpty, IsOptional, Length } from "class-validator";
import { Artwork } from "../../artwork/entities/artwork.entity";

export class UpdateLabelDTO {

    @IsNotEmpty()
    @Length(3, 254)
    public name: string;

    @IsOptional()
    public geniusId?: string;

    @IsOptional()
    public artwork?: Artwork;

    @IsOptional()
    public description?: string;

}