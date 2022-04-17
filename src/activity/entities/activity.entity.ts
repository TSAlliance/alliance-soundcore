import { CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { Song } from "../../song/entities/song.entity";
import { User } from "../../user/entities/user.entity";

@Entity()
export class Activity {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CreateDateColumn()
    public streamedAt: Date;

    @ManyToOne(() => User)
    public user: User;

    @ManyToOne(() => Song)
    public song: Song;

    @ManyToOne(() => Playlist)
    public playlist: Playlist;

}