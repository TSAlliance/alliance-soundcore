import { CanRead, SSOUser } from "@tsalliance/sso-nest";
import { BeforeInsert, BeforeUpdate, Column, Entity, Index, OneToMany } from "typeorm";
import { LikedSong } from "../../collection/entities/liked-song.entity";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { Stream } from "../../stream/entities/stream.entity";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class User extends SSOUser {

    @Index()
    @Column({ nullable: true })
    public username: string;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

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

    @BeforeInsert()
    public onBeforeInsert() {
        const title = `${this.username.toLowerCase().replace(/[^a-zA-Z ]/g, "").replace(/\s+/g, "-")}`        
        this.slug = Slug.create(title);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        const title = `${this.username.toLowerCase().replace(/[^a-zA-Z ]/g, "").replace(/\s+/g, "-")}`        
        this.slug = Slug.create(title);
    }
}