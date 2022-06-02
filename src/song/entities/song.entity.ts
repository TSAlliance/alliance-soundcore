
import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, Index as IndexDec } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Artist } from "../../artist/entities/artist.entity";
import { Distributor } from "../../distributor/entities/distributor.entity";
import { Genre } from "../../genre/entities/genre.entity";
import { Index } from "../../index/entities/index.entity";
import { Label } from "../../label/entities/label.entity";
import { PlaylistItem } from "../../playlist/entities/playlist-item.entity";
import { Publisher } from "../../publisher/entities/publisher.entity";
import { Stream } from "../../stream/entities/stream.entity";
import { SongAlbumOrder } from "./song-order.entity";
import { Slug } from "../../utils/slugGenerator";
import { Resource, ResourceType } from "../../utils/entities/resource";
import { LikedResource } from "../../collection/entities/like.entity";
import { File } from "../../file/entities/file.entity";

@Entity()
export class Song implements Resource {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ default: "song" as ResourceType, update: false })
    public resourceType: ResourceType;

    @Column({ nullable: true, length: 120 })
    public slug: string;
    
    @Column({ nullable: true })
    public geniusId: string;

    @IndexDec()
    @Column({ nullable: true, name: "title" })
    public name: string;

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

    @OneToOne(() => File, { onDelete: "CASCADE" })
    @JoinColumn()
    public file: File;

    // @ManyToOne(() => Artwork, { onDelete: "SET NULL" })
    // @JoinColumn()
    // public banner: Artwork;

    // @ManyToOne(() => Artwork, { onDelete: "SET NULL" })
    // @JoinColumn()
    // public artwork: Artwork;

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

    @OneToMany(() => PlaylistItem, pi => pi.song)
    public playlists: PlaylistItem[];

    @OneToMany(() => Stream, stream => stream.song)
    public streams: Stream[];

    @OneToMany(() => LikedResource, (l) => l.song)
    public likedBy: LikedResource[];

    // Value that will be set if the songs of a playlist
    // are fetched
    public playlistAdded: Date;
    public streamCount?: number;
    public liked?: boolean;
    public likedAt?: Date;
    public order?: number;

    @BeforeInsert()
    public onBeforeInsert() {
        this.slug = Slug.create(this.name);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        this.slug = Slug.create(this.name);
    }

}