
import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { LikedResource } from "../../collection/entities/like.entity";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { Stream } from "../../stream/entities/stream.entity";
import { Resource, ResourceType } from "../../utils/entities/resource";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class User implements Resource {

    @PrimaryColumn({ type: "varchar" })
    public id: string;

    @Column({ default: "user" as ResourceType, update: false })
    public resourceType: ResourceType;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

    @Column({ nullable: true, length: 120, name: "username" })
    public name: string;

    @Column({ nullable: true })
    public accentColor: string;
    
    @OneToMany(() => Stream, stream => stream.listener)
    public streams: Stream[];
    
    @OneToMany(() => Playlist, (p) => p.author)
    public playlists: Playlist[];
    
    @OneToMany(() => LikedResource, (l) => l.user, { onDelete: "CASCADE" })
    public likedSongs: LikedResource;

    @CreateDateColumn()
    public createdAt: Date;

    @UpdateDateColumn()
    public updatedAt: Date;

    public friendsCount = 0;
    public playlistCount = 0;

    @BeforeInsert()
    public onBeforeInsert() {
        this.slug = Slug.create(this.name);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        this.slug = Slug.create(this.name);
    }
}