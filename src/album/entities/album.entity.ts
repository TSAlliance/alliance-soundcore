import { CanRead } from "@tsalliance/sso-nest";
import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artist } from "../../artist/entities/artist.entity";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Distributor } from "../../distributor/entities/distributor.entity";
import { Label } from "../../label/entities/label.entity";
import { Publisher } from "../../publisher/entities/publisher.entity";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Album {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CanRead(false)
    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: false })
    public title: string;

    @Column({ nullable: true })
    public released: Date;

    @Column({ nullable: true, type: "text" })
    public description: string;

    @ManyToMany(() => Artist)
    @JoinTable({ name: "album2artist" })
    public artists: Artist[];

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

}