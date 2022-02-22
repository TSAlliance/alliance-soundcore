import { RandomUtil } from "@tsalliance/rest";
import { CanRead } from "@tsalliance/sso-nest";
import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artist } from "../../artist/entities/artist.entity";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Distributor } from "../../distributor/entities/distributor.entity";
import { Label } from "../../label/entities/label.entity";
import { Publisher } from "../../publisher/entities/publisher.entity";
import { Song } from "../../song/entities/song.entity";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class Album {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

    @CanRead(false)
    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: false })
    public title: string;

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

    @OneToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public artwork: Artwork;

    @OneToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public banner: Artwork;

    @ManyToOne(() => Distributor, { onDelete: "SET NULL" })
    @JoinColumn()
    public distributor: Distributor;

    @ManyToOne(() => Label, { onDelete: "SET NULL" })
    @JoinColumn()
    public label: Label;

    @ManyToOne(() => Publisher, { onDelete: "SET NULL" })
    @JoinColumn()
    public publisher: Publisher;

    public songsCount?: number;
    public totalDuration?: number;
    public featuredArtists?: Artist[];

    @BeforeInsert()
    public onBeforeInsert() {
        const title = `${this.title.toLowerCase().replace(/[^a-zA-Z ]/g, "").replace(/\s+/g, "-")}`        
        this.slug = Slug.create(title);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        const title = `${this.title.toLowerCase().replace(/[^a-zA-Z ]/g, "").replace(/\s+/g, "-")}`        
        this.slug = Slug.create(title);
    }
}