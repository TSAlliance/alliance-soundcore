import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { StorageBucket } from "./storage-bucket.entity";

@Entity()
export class StorageMount {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false, unique: true })
    public path: string;

    @ManyToOne(() => StorageBucket, { onDelete: "CASCADE" })
    public bucket: StorageBucket;

}