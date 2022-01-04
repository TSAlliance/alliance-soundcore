import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Label {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: false })
    public name: string;

    @OneToMany(() => Song, (song) => song.label)
    public songs: Song[]

}