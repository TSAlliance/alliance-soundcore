import { IsNotEmpty, Length } from "class-validator";

export class CreateArtistDto {

    @IsNotEmpty()
    @Length(3, 32)
    public name: string;

}
