import { CanRead, SSOUser } from "@tsalliance/sso-nest";
import { Column, Entity, OneToMany } from "typeorm";
import { LikedSong } from "../../collection/entities/liked-song.entity";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { Stream } from "../../stream/entities/stream.entity";

@Entity()
export class User extends SSOUser {

    @Column({ nullable: true })
    public username: string;

    @Column({ nullable: true })
    public avatarResourceId: string;

    @Column({ nullable: true })
    public accentColor: string;

    @CanRead(false)
    @OneToMany(() => Stream, stream => stream.listener)
    public streams: Stream[];

    @CanRead(false)
    @OneToMany(() => Playlist, (p) => p.author)
    public playlists: Playlist[];

    @CanRead(false)
    @OneToMany(() => LikedSong, (l) => l.user, { onDelete: "CASCADE" })
    public user: LikedSong;

}