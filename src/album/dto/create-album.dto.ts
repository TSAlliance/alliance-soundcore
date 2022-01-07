import { IsDate, IsNotEmpty, IsOptional, Length } from "class-validator";
import { Artist } from "../../artist/entities/artist.entity";
import { Distributor } from "../../distributor/entities/distributor.entity";
import { Label } from "../../label/entities/label.entity";
import { Publisher } from "../../publisher/entities/publisher.entity";
import { Song } from "../../song/entities/song.entity";

export class CreateAlbumDTO {

    @IsNotEmpty()
    @Length(3, 120)
    public title: string;

    @IsOptional()
    @IsDate()
    public released?: Date;

    @IsOptional()
    public geniusId?: string;

    @IsOptional()
    public artists?: Artist[];

    @IsOptional()
    public songs?: Song[];

    @IsOptional()
    public distributor?: Distributor;

    @IsOptional()
    public label?: Label;

    @IsOptional()
    public publisher?: Publisher;

    @IsOptional()
    public mountId?: string;

}