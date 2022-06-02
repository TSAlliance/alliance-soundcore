import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Mount } from "../../mount/entities/mount.entity";
import { Song } from "../../song/entities/song.entity";

export enum FileFlag {
    OK = 0,
    CORRUPT,
    DUPLICATE,
    DELETED,
    PROCESSING,
    FAILED_SONG_CREATION,
}

@Entity()
export class File {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Index({ unique: false })
    @Column()
    public name: string;

    @Index({ unique: false })
    @Column({ length: 255, collation: "utf8mb4_0900_as_ci" })
    public directory: string;

    @Column({ nullable: true, default: 0 })
    public size: number;

    @Column({ type: "tinyint", nullable: true, default: 0 })
    public flag: FileFlag

    @OneToMany(() => Song, (song) => song.file)
    public songs: Song[];

    @ManyToOne(() => Mount)
    public mount: Mount;

}