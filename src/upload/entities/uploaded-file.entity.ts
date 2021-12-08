import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Song } from "../../song/entities/song.entity";
import { FileStatus } from "../enums/file-status.enum";
import { FileType } from "../enums/file-type.enum";

@Entity("audio-file")
export class UploadedAudioFile {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public sizeInBytes: number;

    @Column({ nullable: false, default: "processing" })
    public status: FileStatus;

    @Column({ nullable: false, default: "unknown" })
    public fileType: FileType

    @Column({ nullable: true })
    public checksum: string;

    @CreateDateColumn()
    public uploadedAt: Date;

    @OneToOne(() => Song, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    public songMetadata: Song;

}