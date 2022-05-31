import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, TableInheritance } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { Song } from "../../song/entities/song.entity";
import { User } from "../../user/entities/user.entity";

export enum LikedResourceType {
    SONG = 1,
    ALBUM = 2,
    PLAYLIST = 3
}

@Entity()
export class LikedResource {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CreateDateColumn()
    public likedAt: Date;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn()
    public user: User;

    @Column({ type: "tinyint", default: 0 })
    public type: LikedResourceType;

    @ManyToOne(() => Song, { onDelete: "CASCADE" })
    @JoinColumn()
    public song: Song;

    @ManyToOne(() => Playlist, { onDelete: "CASCADE" })
    @JoinColumn()
    public playlist: Playlist;

    @ManyToOne(() => Album, { onDelete: "CASCADE" })
    @JoinColumn()
    public album: Album;

}