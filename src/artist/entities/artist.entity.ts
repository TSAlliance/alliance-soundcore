import { Column, Entity, ManyToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artwork } from "../../artwork/entities/artwork.entity";
import { Song } from "../../song/entities/song.entity";

@Entity()
export class Artist {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: false, unique: true })
    public name: string;

    @ManyToMany(() => Song, { onDelete: "CASCADE" })
    public songs?: Song[]

    @OneToOne(() => Artwork, { onDelete: "CASCADE", nullable: true })
    public artwork?: Artwork;

}
