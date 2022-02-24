import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Index } from "../../index/entities/index.entity";
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

    @OneToMany(() => Index, (i) => i.mount)
    public indices: Index[];

    public indexCount?: number;
    public driveStats?: {
        driveTotalSpace?: number,
        driveUsedSpace?: number,
        mountUsedSpace?: number
    }

}