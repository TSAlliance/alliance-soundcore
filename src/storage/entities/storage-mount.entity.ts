import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { StorageMountStatus } from "../enums/storage-mount-status.enum";
import { StorageBucket } from "./storage-bucket.entity";

@Entity()
export class StorageMount {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false, unique: true })
    public path: string;

    @ManyToOne(() => StorageBucket, { onDelete: "CASCADE" })
    public bucket: StorageBucket;

    @Column({ nullable: false, default: "ok" })
    public status: StorageMountStatus;

}