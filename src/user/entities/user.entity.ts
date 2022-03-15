
import { BeforeInsert, BeforeUpdate, Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { LikedSong } from "../../collection/entities/liked-song.entity";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { Stream } from "../../stream/entities/stream.entity";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class User {

    @PrimaryColumn({ type: "varchar" })
    public id: string;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

    @Column({ nullable: true, length: 120 })
    public username: string;

    @Column({ nullable: true })
    public accentColor: string;

    
    @OneToMany(() => Stream, stream => stream.listener)
    public streams: Stream[];

    
    @OneToMany(() => Playlist, (p) => p.author)
    public playlists: Playlist[];

    
    @OneToMany(() => LikedSong, (l) => l.user, { onDelete: "CASCADE" })
    public likedSongs: LikedSong;

    @BeforeInsert()
    public onBeforeInsert() {
        this.slug = Slug.create(this.username);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        this.slug = Slug.create(this.username);
    }
}