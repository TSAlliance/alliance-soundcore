
import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, Index, JoinColumn, JoinTable, ManyToMany, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Song } from "../../song/entities/song.entity";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class Artist {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

    
    @Column({ nullable: true, unique: true })
    public geniusId: string;

    @Column({ nullable: true, default: false })
    public hasGeniusLookupFailed: boolean;

    @Column({ nullable: true, type: "text" })
    public geniusUrl: string;

    @Column({ nullable: true, type: "text" })
    public description: string;

    @Index({ unique: true })
    @Column({ nullable: false })
    public name: string;

    @CreateDateColumn()
    public registeredAt: Date;

    @ManyToMany(() => Song)
    @JoinTable({ name: "artist2song" })
    public songs: Song[];

    @OneToMany(() => Album, (a) => a.artist)
    public albums: Album[];

    @OneToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public banner: Artwork;

    @OneToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public artwork: Artwork;

    songCount?: number;
    albumCount?: number;
    streamCount?: number;
    // Refers to the user that performs the request
    likedCount?: number;

    @BeforeInsert()
    public onBeforeInsert() {
        this.slug = Slug.create(this.name);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        this.slug = Slug.create(this.name);
    }

}