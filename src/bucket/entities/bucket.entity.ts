import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Resource, ResourceType } from "../../utils/entities/resource";
import { Mount } from "./mount.entity";

@Entity()
export class Bucket implements Resource {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ default: "bucket" as ResourceType, update: false })
    public resourceType: ResourceType;

    @Column({ nullable: false })
    public name: string;

    @OneToMany(() => Mount, (mount) => mount.bucket)
    public mounts: Mount[];

    public mountsCount?: number;

}