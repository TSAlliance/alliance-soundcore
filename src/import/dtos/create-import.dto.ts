import { IsNotEmpty, IsOptional, IsUrl, Length } from "class-validator";

export class CreateImportDTO {

    @IsNotEmpty()
    @IsUrl()
    public url: string;

    @IsOptional()
    public mountId?: string;

    @IsOptional()
    public startTime?: number;

    @IsOptional()
    @Length(3, 254)
    public title?: string;

    @IsOptional()
    @Length(3, 254)
    public artists?: string[];

    @IsOptional()
    @Length(3, 254)
    public albums?: string[];

}