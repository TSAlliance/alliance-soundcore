import { BeforeInsert, BeforeUpdate, Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Resource, ResourceType } from "../../utils/entities/resource";
import { Slug } from "../../utils/slugGenerator";
import { Mount } from "./mount.entity";

@Entity()
export class Bucket implements Resource {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ default: "bucket" as ResourceType, update: false })
    public resourceType: ResourceType;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

    @Column({ nullable: false })
    public name: string;

    @OneToMany(() => Mount, (mount) => mount.bucket)
    public mounts: Mount[];

    public mountsCount?: number;

    @BeforeInsert()
    public onBeforeInsert() {
        this.slug = Slug.create(this.name);
    }

    @BeforeUpdate() 
    public onBeforeUpdate() {
        this.slug = Slug.create(this.name);
    }

}