
import { BeforeInsert, BeforeUpdate, Column, Entity, Index, JoinColumn, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Song } from "../../song/entities/song.entity";
import { Resource, ResourceFlag, ResourceType } from "../../utils/entities/resource";
import { Slug } from "@tsalliance/utilities";

@Entity()
export class Publisher implements Resource {
    public resourceType: ResourceType = "publisher";

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ type: "tinyint", default: 0 })
    public flag: ResourceFlag;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;
    
    @Column({ nullable: true })
    public geniusId: string;

    @Index()
    @Column({ nullable: false })
    public name: string;

    @Column({ nullable: true, type: "text" })
    public description: string;

    @ManyToOne(() => Artwork, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    public artwork: Artwork;

    @ManyToMany(() => Song)
    public songs: Song[];

    @BeforeInsert()
    public onBeforeInsert() {
        this.slug = Slug.create(this.name);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        if(!this.slug) Slug.create(this.name);
    }

}