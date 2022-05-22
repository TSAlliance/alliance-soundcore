import { IsOptional, Length } from "class-validator";

export class UpdateMountDTO {

    @IsOptional()
    @Length(3, 32)
    public name: string;

    @IsOptional()
    @Length(3, 4095)
    public directory: string;

    @IsOptional()
    @Length(36)
    public bucketId: string;

    @IsOptional()
    public doScan?: boolean = true;

    @IsOptional()
    public setAsDefault?: boolean = false;

}