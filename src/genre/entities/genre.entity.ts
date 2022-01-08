import { CanRead } from "@tsalliance/sso-nest";
import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Genre {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CanRead(false)
    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: false })
    public name: string;

    @ManyToMany(() => Song)
    @JoinTable({ name: "song2genre" })
    public songs: Song[];

}