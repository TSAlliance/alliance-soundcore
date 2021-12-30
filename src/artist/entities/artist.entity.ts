import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Artist {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: false, unique: true })
    public name: string;

    @CreateDateColumn()
    public registeredAt: Date;

    @ManyToMany(() => Song)
    @JoinTable({ name: "artist2song" })
    public songs: Song[];

    @ManyToMany(() => Album)
    @JoinTable({ name: "album2artist" })
    public albums: Album[];

}