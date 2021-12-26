import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Bucket } from "./bucket.entity";

@Entity()
export class Mount {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public name: string;

    @Column({ nullable: false, type: "text" })
    public path: string;

    @ManyToOne(() => Bucket, { onDelete: "CASCADE" })
    @JoinColumn()
    public bucket: Bucket;

}