import { IsNotEmpty, Length } from "class-validator";

export class CreateAlbumDTO {

    @IsNotEmpty()
    @Length(3, 120)
    public title: string;

    public artists?: {id: string}[];

}