import { IsNotEmpty, IsOptional, Length } from "class-validator";

export class CreateMountDTO {

    @IsNotEmpty()
    @Length(3, 32)
    public name: string;

    @IsNotEmpty()
    @Length(3, 4095)
    public path: string;

    @IsOptional()
    public bucket?: { id: string };

}