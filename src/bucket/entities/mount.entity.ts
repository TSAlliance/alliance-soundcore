import { BeforeInsert, BeforeUpdate, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Index } from "../../index/entities/index.entity";
import { Resource, ResourceType } from "../../utils/entities/resource";
import { Slug } from "../../utils/slugGenerator";
import { MountStatus } from "../enums/mount-status.enum";
import { Bucket } from "./bucket.entity";

@Entity()
export class Mount implements Resource {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ default: "mount" as ResourceType, update: false })
    public resourceType: ResourceType;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

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

    @BeforeInsert()
    public onBeforeInsert() {
        this.slug = Slug.create(this.name);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        this.slug = Slug.create(this.name);
    }

}