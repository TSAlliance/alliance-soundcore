import { SSOUser } from "@tsalliance/sso-nest";
import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
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

    @ManyToMany(() => SSOUser)
    @JoinTable({ name: "collaborators2playlist" })
    public collaborators: SSOUser[];

    @ManyToOne(() => SSOUser)
    @JoinColumn()
    public author: SSOUser;

    @ManyToMany(() => Song)
    @JoinTable({ name: "song2playlist" })
    public songs: Song[]

}