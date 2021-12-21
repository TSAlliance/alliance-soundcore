import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { StorageMount } from "./storage-mount.entity";

@Entity()
export class StorageBucket {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false, length: 64, unique: true })
    public name: string;

    @Column({ nullable: false, length: 64 })
    public machineId: string;

    @Column({ nullable: false, default: false })
    public isolated: boolean;

    @OneToMany(() => StorageMount, (mount) => mount.bucket)
    public mounts: StorageMount[];

}