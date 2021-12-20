import { CanRead } from "@tsalliance/rest";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { ArtworkType } from "../enums/artwork-type.enum";

@Entity()
export class Artwork {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CanRead(false)
    @Column({ nullable: false, default: ArtworkType.SONG_COVER })
    public type: ArtworkType    

}