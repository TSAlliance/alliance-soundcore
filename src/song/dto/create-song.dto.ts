import { IsNotEmpty, IsNumber } from "class-validator";

export class CreateSongDTO {

    @IsNotEmpty()
    public title: string;

    @IsNotEmpty()
    @IsNumber()
    public durationInSeconds: number;

    @IsNotEmpty()
    public file: { id: string }


}