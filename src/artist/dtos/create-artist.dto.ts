import { IsNotEmpty, IsOptional, IsUrl, Length } from "class-validator";

export class CreateArtistDTO {

    @IsNotEmpty()
    @Length(3, 254)
    public name: string;

    @IsOptional()
    @Length(3, 4000)
    public description?: string;

    @IsOptional()
    public geniusId?: string;

    @IsOptional()
    @IsUrl()
    public geniusUrl?: string;

    @IsOptional()
    public mountForArtworkId?: string;


    

}