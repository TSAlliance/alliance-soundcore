import { SSOUser } from "@tsalliance/sso-nest";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Song } from "../../song/entities/song.entity";
import { FileStatus } from "../enums/file-status.enum";

@Entity("audio-file")
export class UploadedAudioFile {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public sizeInBytes: number;

    @Column({ nullable: false })
    public originalName: string;

    @Column({ nullable: false, default: "processing" })
    public status: FileStatus;

    @Column({ nullable: true })
    public checksum: string;

    @CreateDateColumn()
    public uploadedAt: Date;

    @OneToOne(() => Song, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    public metadata: Song;

    @ManyToOne(() => SSOUser, { nullable: true, onDelete: "SET NULL"})
    @JoinColumn()
    public uploader: SSOUser;

}