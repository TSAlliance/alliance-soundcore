import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Distributor {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: true })
    public geniusId: string;

    @Column({ nullable: false })
    public name: string;

    @OneToOne(() => Artwork, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    public artwork: Artwork;

    @OneToMany(() => Song, (user) => user.publisher)
    public songs: Song[]

}