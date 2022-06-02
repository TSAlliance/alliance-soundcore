
import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, Index, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Song } from "../../song/entities/song.entity";
import { Resource, ResourceFlag, ResourceType } from "../../utils/entities/resource";
import { Slug } from "../../utils/slugGenerator";

@Entity()
export class Artist implements Resource {
    
    public resourceType: ResourceType = "artist";

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ type: "tinyint", default: 0 })
    public flag: ResourceFlag;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;
    
    @Column({ nullable: true, unique: true })
    public geniusId: string;

    @Column({ nullable: true, type: "text" })
    public description: string;

    @Index({ unique: true })
    @Column({ nullable: false })
    public name: string;

    @CreateDateColumn()
    public createdAt: Date;

    @ManyToMany(() => Song)
    @JoinTable({ name: "artist2song" })
    public songs: Song[];

    @OneToMany(() => Album, (a) => a.artist)
    public albums: Album[];

    /*@ManyToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public banner: Artwork;

    @ManyToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public artwork: Artwork;*/

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