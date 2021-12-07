import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { UploadedFile } from "../../upload/entities/uploaded-file.entity";

import { CanRead } from "@tsalliance/rest"

@Entity()
export class Song {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public title: string;

    @Column({ nullable: false })
    public durationInSeconds: number;

    // TODO: public artist: any;
    // TODO: public album: any;
    // TODO: public playlists: any[];

    @CanRead(false)
    @ManyToOne(() => UploadedFile, { onDelete: "CASCADE" })
    @JoinColumn()
    public file: UploadedFile;

}