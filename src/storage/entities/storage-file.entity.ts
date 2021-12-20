import { Column, CreateDateColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { StorageMount } from "./storage-mount.entity";

export abstract class StorageFile {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public sizeInBytes: number;

    @Column({ nullable: true })
    public originalName: string;

    @ManyToOne(() => StorageMount, { onDelete: "CASCADE" })
    public mount: StorageMount;

    @CreateDateColumn()
    public createdAt: Date;

}