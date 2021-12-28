import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { MountStatus } from "../enums/mount-status.enum";
import { Bucket } from "./bucket.entity";

@Entity()
export class Mount {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public name: string;

    @Column({ nullable: false, type: "text" })
    public path: string;

    @Column({ nullable: false, default: "ok" })
    public status: MountStatus;

    @ManyToOne(() => Bucket, { onDelete: "CASCADE" })
    @JoinColumn()
    public bucket: Bucket;

}