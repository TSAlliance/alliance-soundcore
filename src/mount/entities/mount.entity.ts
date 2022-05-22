import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Bucket } from "../../bucket/entities/bucket.entity";
import { Index } from "../../index/entities/index.entity";
import { MountStatus } from "../enums/mount-status.enum";

@Entity()
export class Mount {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ length: 32 })
    public name: string;

    @Column({ nullable: false, type: "text" })
    public directory: string;

    @CreateDateColumn()
    public createdAt: Date;

    @UpdateDateColumn()
    public updatedAt: Date;

    @Column({ type: "datetime", nullable: true })
    public lastScannedAt: Date;

    @Column({ nullable: false, default: "ok" })
    public status: MountStatus;

    @Column({ default: true })
    public isDefault: boolean;

    @ManyToOne(() => Bucket, { onDelete: "CASCADE" })
    @JoinColumn()
    public bucket: Bucket;

    @OneToMany(() => Index, (i) => i.mount)
    public indices: Index[];

    // Below fields may only be populated
    // after custom database queries.
    public indexCount?: number;
    public usedDiskSpace?: number;

}