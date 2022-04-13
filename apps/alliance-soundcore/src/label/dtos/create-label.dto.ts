import { IsNotEmpty, IsOptional, IsUrl, Length } from "class-validator";

export class CreateLabelDTO {

    @IsNotEmpty()
    @Length(3, 254)
    public name: string;

    @IsOptional()
    public geniusId: string;

    @IsOptional()
    @IsUrl()
    public externalImgUrl: string;

    @IsOptional()
    public artworkMountId?: string;

}