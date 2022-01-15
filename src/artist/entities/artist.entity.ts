import { CanRead } from "@tsalliance/sso-nest";
import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Artist {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CanRead(false)
    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: true, type: "text" })
    public geniusUrl: string;

    @Column({ nullable: true, type: "text" })
    public description: string;

    @Column({ nullable: false, unique: true })
    public name: string;

    @CreateDateColumn()
    public registeredAt: Date;

    @ManyToMany(() => Song)
    @JoinTable({ name: "artist2song" })
    public songs: Song[];

    @ManyToMany(() => Album)
    @JoinTable({ name: "album2artist" })
    public albums: Album[];

    @OneToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public banner: Artwork;

    @OneToOne(() => Artwork, { onDelete: "SET NULL" })
    @JoinColumn()
    public artwork: Artwork;

}