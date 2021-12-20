import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { UploadedAudioFile } from "../../upload/entities/uploaded-file.entity";

import { CanRead } from "@tsalliance/rest"
import { Artist } from "../../artist/entities/artist.entity";
import { Artwork } from "../../artwork/entities/artwork.entity";

@Entity()
export class Song {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false })
    public title: string;

    @Column({ nullable: false })
    public durationInSeconds: number;

    // TODO: public album: any;
    // TODO: public playlists: any[];

    @ManyToMany(() => Artist, (artist) => artist.songs, { onDelete: "CASCADE" })
    @JoinTable({ name: "song2artists" })
    public artists: Artist[];

    @CanRead(false)
    @OneToOne(() => UploadedAudioFile, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    public file: UploadedAudioFile;

    @OneToOne(() => Artwork, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    public artwork: Artwork;

    @CreateDateColumn()
    public createdAt: Date;

}