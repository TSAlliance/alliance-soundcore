import { IsOptional, Length } from "class-validator";

export class UpdateMountDTO {

    @IsOptional()
    @Length(3, 32)
    public name: string;

    @IsOptional()
    @Length(3, 4095)
    public path: string;

}