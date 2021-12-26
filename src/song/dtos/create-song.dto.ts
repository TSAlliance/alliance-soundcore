import { IsNotEmpty, IsNumber, Length } from "class-validator";

export class CreateSongDTO {

    @IsNotEmpty()
    @Length(3, 254)
    public title: string;

    @IsNotEmpty()
    @IsNumber()
    public duration: number;

}