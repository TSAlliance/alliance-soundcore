import { SSOUser } from "@tsalliance/sso-nest";
import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Mount } from "../../bucket/entities/mount.entity";
import { Song } from "../../song/entities/song.entity";
import { IndexStatus } from "../enum/index-status.enum";

@Entity()
export class Index {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public filename: string;

    @Column({ nullable: false, default: 0})
    public size: number;

    @Column({ nullable: false, default: "preparing"})
    public status: IndexStatus;

    @Column({ nullable: true, type: "text"})
    public checksum: string;

    @OneToOne(() => Song, { onDelete: "CASCADE" })
    @JoinColumn()
    public song: Song;

    @ManyToOne(() => Mount, { onDelete: "CASCADE" })
    public mount: Mount;

    @ManyToOne(() => SSOUser, { onDelete: "SET NULL" })
    public uploader: SSOUser; 

}