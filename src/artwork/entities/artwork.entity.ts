import { CanRead } from "@tsalliance/rest";
import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artist } from "../../artist/entities/artist.entity";
import { Song } from "../../song/entities/song.entity";
import { ArtworkType } from "../enums/artwork-type.enum";

@Entity()
export class Artwork {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CanRead(false)
    @Column({ nullable: false, default: ArtworkType.SONG_COVER })
    public type: ArtworkType

    @CanRead(false)
    @OneToOne(() => Song, { onDelete: "CASCADE", nullable: true })
    public song?: Song;

    @CanRead(false)
    @OneToOne(() => Artist, { onDelete: "SET NULL", nullable: true })
    public artist?: Artist;

    // TODO:
    public playlist?: any;
    public album?: any;

    

}