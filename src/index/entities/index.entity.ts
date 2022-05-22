import path from "node:path";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, Index as IndexDec, BeforeInsert, BeforeUpdate } from "typeorm";
import { IndexReport } from "../../index-report/entities/report.entity";
import { Mount } from "../../mount/entities/mount.entity";
import { Song } from "../../song/entities/song.entity";
import { User } from "../../user/entities/user.entity";
import { Resource, ResourceType } from "../../utils/entities/resource";
import { Slug } from "../../utils/slugGenerator";
import { IndexStatus } from "../enum/index-status.enum";

export type IndexRawPath = {
    index_directory: string;
    index_filename: string;
    mount_id: string;
}

@Entity()
@IndexDec("UK_index_filename_directory", ["name", "directory", "mount.id"], { unique: true })
export class Index implements Resource {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ default: "index" as ResourceType, update: false })
    public resourceType: ResourceType;

    @Column({ nullable: false, default: '.' })
    public directory: string;

    @Column({ nullable: true, unique: true, length: 120 })
    public slug: string;

    @Column({ nullable: false, name: "filename" })
    public name: string;

    @Column({ nullable: false, default: 0})
    public size: number;

    @Column({ nullable: false, default: "preparing"})
    public status: IndexStatus;

    @Column({ nullable: true, type: "text"})
    public checksum: string;

    @OneToOne(() => Song, { onDelete: "CASCADE" })
    @JoinColumn()
    public song: Song;

    @ManyToOne(() => Mount, { onDelete: "CASCADE" })
    public mount: Mount;

    @ManyToOne(() => User, { onDelete: "SET NULL" })
    public uploader: User;

    @OneToOne(() => IndexReport, { onDelete: "SET NULL" })
    @JoinColumn()
    public report: IndexReport;

    @CreateDateColumn()
    public indexedAt: Date;

    public get fullPath(): string {
        return path.join(this.directory || ".", this.name);
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