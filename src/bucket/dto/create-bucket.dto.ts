import { IsNotEmpty, IsOptional, Length } from "class-validator";

export class CreateBucketDTO {

    @IsNotEmpty()
    @Length(3, 32)
    public name: string;

    @IsOptional()
    public isolated?: boolean;

}