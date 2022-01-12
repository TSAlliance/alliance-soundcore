import { SSOUser } from "@tsalliance/sso-nest";
import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Song } from "../../song/entities/song.entity";
import { PlaylistPrivacy } from "../enums/playlist-privacy.enum";

@Entity()
export class Playlist {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public title: string;

    @Column({ nullable: true })
    public description: string;

    @Column({ nullable: false, default: "public" })
    public privacy: PlaylistPrivacy;

    @Column({ nullable: false, default: false })
    public collaborative: boolean;

    @CreateDateColumn()
    public createdAt: Date;

    @ManyToMany(() => SSOUser)
    @JoinTable({ name: "collaborators2playlist" })
    public collaborators: SSOUser[];

    @ManyToOne(() => SSOUser)
    @JoinColumn()
    public author: SSOUser;

    @ManyToMany(() => Song)
    @JoinTable({ name: "song2playlist" })
    public songs: Song[]

    @OneToOne(() => Artwork, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    public artwork: Artwork;


    public songsCount?: number = 0;
    public collaboratorsCount?: number = 0;
    public totalDuration?: number = 0;

}