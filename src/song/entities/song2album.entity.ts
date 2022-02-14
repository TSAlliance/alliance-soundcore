import { Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Song } from "./song.entity";
import { Album } from "../../album/entities/album.entity";

@Entity({ name: "song2album" })
export class Song2Album {
    
    @ManyToOne(() => Song, s => s.albums, { onDelete: "CASCADE" })
    @PrimaryColumn({ type: "varchar", name: "songId" })
    public song!: Song;
    
    @ManyToOne(() => Album, a => a.songs, { onDelete: "CASCADE" })
    @PrimaryColumn({ type: "varchar", name: "albumId" })
    public album!: Album;

    @Column({ nullable: true })
    public titleNr?: number;

}