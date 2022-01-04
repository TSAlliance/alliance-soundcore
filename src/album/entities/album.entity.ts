import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Artist } from "../../artist/entities/artist.entity";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Album {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: false })
    public title: string;

    @ManyToMany(() => Artist)
    @JoinTable({ name: "album2artist" })
    public artists: Artist[];

    @ManyToMany(() => Song)
    @JoinTable({ name: "song2album" })
    public songs: Song[];

}