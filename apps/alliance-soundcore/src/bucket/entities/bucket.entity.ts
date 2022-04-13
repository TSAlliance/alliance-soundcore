import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Mount } from "./mount.entity";

@Entity()
export class Bucket {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public name: string;

    @OneToMany(() => Mount, (mount) => mount.bucket)
    public mounts: Mount[];

    public mountsCount?: number;

}