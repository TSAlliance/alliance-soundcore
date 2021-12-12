import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Artist {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public name: string;

    @ManyToMany(() => Song)
    public songs: Song[]

}
