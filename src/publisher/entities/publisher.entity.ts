
import { BeforeInsert, BeforeUpdate, Column, Entity, Index, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Song } from "../../song/entities/song.entity";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class Publisher {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

    @Column({ nullable: true, default: false })
    public hasGeniusLookupFailed: boolean;

    
    @Column({ nullable: true })
    public geniusId: string;

    @Index()
    @Column({ nullable: false })
    public name: string;

    @OneToOne(() => Artwork, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    public artwork: Artwork;

    @OneToMany(() => Song, (user) => user.publisher)
    public songs: Song[];

    @BeforeInsert()
    public onBeforeInsert() {
        this.slug = Slug.create(this.name);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        this.slug = Slug.create(this.name);
    }

}