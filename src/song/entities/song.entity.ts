import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { UploadedAudioFile } from "../../upload/entities/uploaded-file.entity";

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
    @OneToOne(() => UploadedAudioFile, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    public file: UploadedAudioFile;

    @CreateDateColumn()
    public createdAt: Date;

}