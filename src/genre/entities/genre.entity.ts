
import { BeforeInsert, BeforeUpdate, Column, Entity, Index, JoinTable, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Song } from "../../song/entities/song.entity";
import { Resource, ResourceFlag, ResourceType } from "../../utils/entities/resource";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class Genre implements Resource {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ type: "tinyint", default: 0 })
    public flag: ResourceFlag;

    public resourceType: ResourceType = "genre";

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;
    
    @Column({ nullable: true })
    public geniusId: string;

    @Index()
    @Column({ nullable: false })
    public name: string;

    @ManyToMany(() => Song)
    @JoinTable({ name: "song2genre" })
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