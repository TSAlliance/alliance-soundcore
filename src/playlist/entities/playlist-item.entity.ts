import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Song } from "../../song/entities/song.entity";
import { User } from "../../user/entities/user.entity";
import { Playlist } from "./playlist.entity";

@Entity({ name: "song2playlist" })
export class PlaylistItem {

    @PrimaryGeneratedColumn({ unsigned: true, type: "bigint" })
    public id!: number;

    @Column()
    public songId!: string;

    @Column()
    public playlistId!: string;

    @CreateDateColumn()
    public createdAt: Date;

    @Column({ nullable: true, default: 0 })
    public order: number;

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    public addedBy: User;

    @ManyToOne(() => Song, s => s.playlists, { onDelete: "CASCADE" })
    public song!: Song;

    @ManyToOne(() => Playlist, p => p.items, { onDelete: "CASCADE" })
    public playlist!: Playlist;

}