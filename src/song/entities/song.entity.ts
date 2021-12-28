import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Artist } from "../../artist/entities/artist.entity";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Index } from "../../index/entities/index.entity";
import { Label } from "../../label/entities/label.entity";
import { Publisher } from "../../publisher/entities/publisher.entity";

@Entity()
export class Song {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

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

    @OneToOne(() => Index, { onDelete: "CASCADE" })
    @JoinColumn()
    public index: Index;

    @OneToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public artwork: Artwork;

    @ManyToMany(() => Artist)
    @JoinTable({ name: "artist2song" })
    public artists: Artist[];

    @ManyToOne(() => Publisher, { onDelete: "SET NULL" })
    @JoinColumn()
    public publisher: Publisher;

    @ManyToOne(() => Label, { onDelete: "SET NULL" })
    @JoinColumn()
    public label: Label;

    @ManyToMany(() => Album)
    @JoinTable({ name: "song2album" })
    public albums: Album[];

}