import { CanRead } from "@tsalliance/sso-nest";
import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Artist } from "../../artist/entities/artist.entity";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Distributor } from "../../distributor/entities/distributor.entity";
import { Index } from "../../index/entities/index.entity";
import { Label } from "../../label/entities/label.entity";
import { Publisher } from "../../publisher/entities/publisher.entity";

@Entity()
export class Song {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CanRead(false)
    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: true })
    public title: string;

    @Column({ nullable: false, default: 0 })
    public duration: number;

    @Column({ type: "text", nullable: true })
    public location: string;

    @Column({ type: "text", nullable: true })
    public youtubeUrl: string;

    @Column({ nullable: true, type: "date" })
    public released: Date;

    @CreateDateColumn()
    public createdAt: Date;

    @Column({ default: false })
    public explicit: boolean;

    @Column({ nullable: true, type: "text" })
    public description: string;

    @Column({ nullable: true, default: '0' })
    public youtubeUrlStart: string;

    @CanRead(false)
    @Column({ nullable: true })
    public api_path: string;

    @Column({ nullable: true })
    public geniusUrl: string;

    @CanRead(false)
    @OneToOne(() => Index, { onDelete: "CASCADE" })
    @JoinColumn()
    public index: Index;

    @OneToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public banner: Artwork;

    @OneToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public artwork: Artwork;

    @ManyToMany(() => Artist)
    @JoinTable({ name: "artist2song" })
    public artists: Artist[];

    @ManyToOne(() => Publisher, { onDelete: "SET NULL" })
    @JoinColumn()
    public publisher: Publisher;

    @ManyToOne(() => Distributor, { onDelete: "SET NULL" })
    @JoinColumn()
    public distributor: Distributor;

    @ManyToOne(() => Label, { onDelete: "SET NULL" })
    @JoinColumn()
    public label: Label;

    @ManyToMany(() => Album)
    @JoinTable({ name: "song2album" })
    public albums: Album[];

    

}