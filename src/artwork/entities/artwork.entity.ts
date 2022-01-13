import { CanRead } from "@tsalliance/sso-nest";
import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Artist } from "../../artist/entities/artist.entity";
import { Mount } from "../../bucket/entities/mount.entity";
import { Distributor } from "../../distributor/entities/distributor.entity";
import { Label } from "../../label/entities/label.entity";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { Song } from "../../song/entities/song.entity";
import { ArtworkType } from "../types/artwork-type.enum";

@Entity()
export class Artwork {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CanRead(false)
    @Column({ default: "song" })
    public type: ArtworkType;

    @Column({ nullable: true })
    public externalUrl: string;

    @Column({ nullable: true })
    public accentColor: string;

    // Prevent duplicate files by specifying filename
    // This also applies to externalImages even if they haven't been downloaded
    // (because they could be downloaded in future)
    @CanRead(false)
    @Column({ nullable: true })
    public dstFilename: string;

    @CanRead(false)
    @ManyToOne(() => Mount, { onDelete: "CASCADE" })
    @JoinColumn()
    public mount: Mount;

    @OneToOne(() => Distributor, { onDelete: "CASCADE" })
    public distributor?: Distributor;

    @OneToOne(() => Label, { onDelete: "CASCADE" })
    public label?: Label;

    @OneToOne(() => Song, { onDelete: "CASCADE" })
    public song?: Song;

    @OneToOne(() => Album, { onDelete: "CASCADE" })
    public album?: Album;

    @OneToOne(() => Artist, { onDelete: "CASCADE" })
    public artist?: Artist;

    @OneToOne(() => Playlist, { onDelete: "CASCADE" })
    public playlist?: Playlist;

}