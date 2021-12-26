import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Artist {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false, unique: true })
    public name: string;

    @ManyToMany(() => Song)
    @JoinTable({ name: "artist2song" })
    public songs: Song[];

}