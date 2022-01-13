import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Song } from "../../song/entities/song.entity";
import { Playlist } from "./playlist.entity";

@Entity({ name: "song2playlist" })
export class Song2Playlist {

    @PrimaryGeneratedColumn()
    public id!: number;

    @Column()
    public songId!: string;

    @Column()
    public playlistId!: string;

    @CreateDateColumn()
    public createdAt: Date;

    @ManyToOne(() => Song, s => s.song2playlist, { onDelete: "CASCADE" })
    public song!: Song;

    @ManyToOne(() => Playlist, p => p.song2playlist, { onDelete: "CASCADE" })
    public playlist!: Playlist;

}