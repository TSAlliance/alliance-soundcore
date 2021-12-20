import { SSOUser } from "@tsalliance/sso-nest";
import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { Song } from "../../song/entities/song.entity";
import { StorageFile } from "../../storage/entities/storage-file.entity";
// import { StorageFile } from "../../storage/entities/storage-file.entity";
import { FileStatus } from "../enums/file-status.enum";

@Entity("audio-file")
export class UploadedAudioFile extends StorageFile {

    @Column({ nullable: false, default: "processing" })
    public status: FileStatus;

    @Column({ nullable: true })
    public checksum: string;

    @OneToOne(() => Song, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    public metadata: Song;

    @ManyToOne(() => SSOUser, { nullable: true, onDelete: "SET NULL"})
    @JoinColumn()
    public uploader: SSOUser;

}