import { CanRead } from "@tsalliance/sso-nest";
import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artist } from "../../artist/entities/artist.entity";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Distributor } from "../../distributor/entities/distributor.entity";
import { Label } from "../../label/entities/label.entity";
import { Publisher } from "../../publisher/entities/publisher.entity";
import { Song } from "../../song/entities/song.entity";
import { Song2Album } from "../../song/entities/song2album.entity";

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

    @CreateDateColumn()
    public createdAt: Date;

    @Column({ nullable: true, type: "text" })
    public description: string;

    @ManyToOne(() => Artist)
    @JoinColumn()
    public artist: Artist;

    @OneToMany(() => Song2Album, (a) => a.song)
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

    public songsCount?: number;
    public totalDuration?: number;
    public featuredArtists?: Artist[];
}