import { CanRead } from "@tsalliance/sso-nest";
import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Label {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @CanRead(false)
    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: false })
    public name: string;

    @OneToMany(() => Song, (song) => song.label)
    public songs: Song[]

    @OneToOne(() => Artwork, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    public artwork: Artwork;

}