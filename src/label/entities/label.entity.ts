
import { BeforeInsert, BeforeUpdate, Column, Entity, Index, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Song } from "../../song/entities/song.entity";
import { Resource, ResourceFlag, ResourceType } from "../../utils/entities/resource";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class Label implements Resource {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ type: "tinyint", default: 0 })
    public flag: ResourceFlag;

    public resourceType: ResourceType = "label";

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

    @Column({ nullable: true, default: false })
    public hasGeniusLookupFailed: boolean;
    
    @Column({ nullable: true })
    public geniusId: string;

    @Index()
    @Column({ nullable: false })
    public name: string;

    @OneToMany(() => Song, (song) => song.label)
    public songs: Song[]

    /*@OneToOne(() => Artwork, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    public artwork: Artwork;*/

    @BeforeInsert()
    public onBeforeInsert() {
        this.slug = Slug.create(this.name);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        this.slug = Slug.create(this.name);
    }

}