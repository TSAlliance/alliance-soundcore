import { Length } from "class-validator";

export class UpdateMountDTO {

    @Length(3, 32)
    public name: string;

    @Length(3, 4095)
    public directory: string;

}