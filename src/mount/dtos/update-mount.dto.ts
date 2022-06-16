import { Length } from "class-validator";

export class UpdateMountDTO {

    @Length(3, 32)
    public name: string;

}