import { CanRead } from "@tsalliance/sso-nest";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Mount } from "../../bucket/entities/mount.entity";
import { ArtworkType } from "../types/artwork-type.enum";

@Entity()
export class Artwork {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CanRead(false)
    @Column({ default: "song" })
    public type: ArtworkType;

    @Column({ nullable: true })
    public externalUrl: string;

    @Column({ nullable: true })
    public accentColor: string;

    // Prevent duplicate files by specifying filename
    // This also applies to externalImages even if they haven't been downloaded
    // (because they could be downloaded in future)
    @CanRead(false)
    @Column({ nullable: true })
    public dstFilename: string;

    @CanRead(false)
    @ManyToOne(() => Mount, { onDelete: "CASCADE" })
    @JoinColumn()
    public mount: Mount;

}