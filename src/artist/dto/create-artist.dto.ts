import { IsNotEmpty, Length } from "class-validator";

export class CreateArtistDto {

    @IsNotEmpty()
    @Length(3, 120)
    public name: string;

}
