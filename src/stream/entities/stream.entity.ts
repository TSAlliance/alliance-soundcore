import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Song } from "../../song/entities/song.entity";
import { User } from "../../user/entities/user.entity";

@Entity()
export class Stream {

    @PrimaryGeneratedColumn({ unsigned: true, type: "bigint" })
    public id!: number;

    @Column()
    public songId: string;

    @Column()
    public listenerId: string;

    @Column({ default: 1 })
    public streamCount: number;

    @ManyToOne(() => Song, s => s.song2playlist, { onDelete: "CASCADE" })
    public song: Song;

    @ManyToOne(() => User, u => u.streams, { onDelete: "CASCADE" })
    public listener: User;

}