
import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artist } from "../../artist/entities/artist.entity";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { LikedResource } from "../../collection/entities/like.entity";
import { Distributor } from "../../distributor/entities/distributor.entity";
import { Label } from "../../label/entities/label.entity";
import { Publisher } from "../../publisher/entities/publisher.entity";
import { Song } from "../../song/entities/song.entity";
import { Resource, ResourceFlag, ResourceType } from "../../utils/entities/resource";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class Album implements Resource {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ type: "tinyint", default: 0 })
    public flag: ResourceFlag;

    public resourceType: ResourceType = "album";

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;
    
    @Column({ nullable: true })
    public geniusId: string;

    @Index()
    @Column({ nullable: false, name: "title" })
    public name: string;

    @Column({ nullable: true, default: false })
    public hasGeniusLookupFailed: boolean;

    @Column({ nullable: true })
    public released: Date;

    @CreateDateColumn()
    public createdAt: Date;

    @Column({ nullable: true, type: "text" })
    public description: string;

    @ManyToOne(() => Artist)
    @JoinColumn()
    public artist: Artist;

    @ManyToMany(() => Song)
    @JoinTable({ name: "song2album" })
    public songs: Song[];

    /*@ManyToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public artwork: Artwork;

    @ManyToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public banner: Artwork;*/

    @ManyToOne(() => Distributor, { onDelete: "SET NULL" })
    @JoinColumn()
    public distributor: Distributor;

    @ManyToOne(() => Label, { onDelete: "SET NULL" })
    @JoinColumn()
    public label: Label;

    @ManyToOne(() => Publisher, { onDelete: "SET NULL" })
    @JoinColumn()
    public publisher: Publisher;

    @OneToMany(() => LikedResource, (l) => l.album)
    public likedBy: LikedResource[];

    public songsCount?: number;
    public totalDuration?: number;
    public featuredArtists?: Artist[];

    @BeforeInsert()
    public onBeforeInsert() {
        this.slug = Slug.create(this.name);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        this.slug = Slug.create(this.name);
    }
}