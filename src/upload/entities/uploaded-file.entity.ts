import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import { FileStatus } from "../enums/file-status.enum";
import { FileType } from "../enums/file-type.enum";

@Entity("file")
export class UploadedFile {

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

}