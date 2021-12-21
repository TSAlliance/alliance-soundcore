import { IsNotEmpty } from "class-validator";

export class CreateMountDTO {

    @IsNotEmpty({ message: "path not set" })
    public path: string;

    public createIfNotExists?: boolean;
    public bucketId?: string;

}