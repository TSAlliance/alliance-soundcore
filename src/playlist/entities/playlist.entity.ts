import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Liked } from "../../collection/entities/like.entity";
import { LikedPlaylist } from "../../collection/entities/liked-playlist.entity";
import { User } from "../../user/entities/user.entity";
import { PlaylistPrivacy } from "../enums/playlist-privacy.enum";
import { Song2Playlist } from "./song2playlist.entity";

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

    @ManyToMany(() => User)
    @JoinTable({ name: "collaborators2playlist" })
    public collaborators: User[];

    @ManyToOne(() => User)
    @JoinColumn()
    public author: User;

    @OneToMany(() => Song2Playlist, song2playlist => song2playlist.playlist)
    public song2playlist!: Song2Playlist[];

    @OneToOne(() => Artwork, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    public artwork: Artwork;

    @OneToMany(() => Liked, (l) => l["playlist"])
    public likedBy: LikedPlaylist[];


    public songsCount?: number = undefined;
    public collaboratorsCount?: number = undefined;
    public totalDuration?: number = undefined;
    public likesCount?: number = undefined;
    public isLiked?: boolean = false;

}