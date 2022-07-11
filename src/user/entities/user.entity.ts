
import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { Like } from "../../collection/entities/like.entity";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { Stream } from "../../stream/entities/stream.entity";
import { Resource, ResourceFlag, ResourceType } from "../../utils/entities/resource";
import { Slug } from "@tsalliance/utilities";
import { Artwork } from "../../artwork/entities/artwork.entity";

@Entity()
export class User implements Resource {
    public resourceType: ResourceType = "user";

    @PrimaryColumn({ type: "varchar" })
    public id: string;

    @Column({ type: "tinyint", default: 0 })
    public flag: ResourceFlag;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

    @Column({ nullable: true, length: 120, name: "username" })
    public name: string;

    @Column({ nullable: true })
    public accentColor: string;
    
    @OneToMany(() => Stream, stream => stream.listener)
    public streams: Stream[];

    @ManyToOne(() => Artwork, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    public artwork: Artwork;
    
    @OneToMany(() => Playlist, (p) => p.author)
    public playlists: Playlist[];
    
    @OneToMany(() => Like, (l) => l.user, { onDelete: "CASCADE" })
    public likedSongs: Like;

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