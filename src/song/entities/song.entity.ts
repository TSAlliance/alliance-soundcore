import { CanRead } from "@tsalliance/sso-nest";
import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Artist } from "../../artist/entities/artist.entity";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Distributor } from "../../distributor/entities/distributor.entity";
import { Genre } from "../../genre/entities/genre.entity";
import { Index } from "../../index/entities/index.entity";
import { Label } from "../../label/entities/label.entity";
import { Liked } from "../../collection/entities/like.entity";
import { LikedSong } from "../../collection/entities/liked-song.entity";
import { Song2Playlist } from "../../playlist/entities/song2playlist.entity";
import { Publisher } from "../../publisher/entities/publisher.entity";
import { Stream } from "../../stream/entities/stream.entity";
import { SongAlbumOrder } from "./song-order.entity";

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

    @Column({ nullable: true })
    public geniusUrl: string;

    @Column({ nullable: false, default: false})
    public hasGeniusLookupFailed: boolean;

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

    @OneToMany(() => SongAlbumOrder, (order) => order.song, { cascade: ["insert", "update", "remove"] })
    public albumOrders: SongAlbumOrder[];

    @ManyToMany(() => Genre)
    @JoinTable({ name: "song2genre" })
    public genres: Genre[];

    @OneToMany(() => Song2Playlist, song2playlist => song2playlist.song)
    public song2playlist: Song2Playlist[];

    @OneToMany(() => Stream, stream => stream.song)
    public streams: Stream[];

    @OneToMany(() => Liked, (l) => l["song"])
    public likedBy: LikedSong[];

    // Value that will be set if the songs of a playlist
    // are fetched
    public playlistAdded: Date;
    public streamCount?: number;
    public likesCount?: number;
    public isLiked?: boolean;
    public likedAt?: Date;
    public order?: number;

}