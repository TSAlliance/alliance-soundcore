import { CanRead } from "@tsalliance/sso-nest";
import { BeforeInsert, BeforeUpdate, Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Song } from "../../song/entities/song.entity";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class Label {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

    @Column({ nullable: true, default: false })
    public hasGeniusLookupFailed: boolean;

    @CanRead(false)
    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: false })
    public name: string;

    @OneToMany(() => Song, (song) => song.label)
    public songs: Song[]

    @OneToOne(() => Artwork, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    public artwork: Artwork;

    @BeforeInsert()
    public onBeforeInsert() {
        const title = `${this.name.toLowerCase().replace(/[^a-zA-Z ]/g, "").replace(/\s+/g, "-")}`        
        this.slug = Slug.create(title);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        const title = `${this.name.toLowerCase().replace(/[^a-zA-Z ]/g, "").replace(/\s+/g, "-")}`        
        this.slug = Slug.create(title);
    }

}