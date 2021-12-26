import { Column, Entity, JoinColumn, ManyToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Artist } from "../../artist/entities/artist.entity";
import { Index } from "../../index/entities/index.entity";

@Entity()
export class Song {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ nullable: true })
    public title: string;

    @Column({ nullable: false, default: 0 })
    public duration: number;

    @OneToOne(() => Index, { onDelete: "CASCADE" })
    @JoinColumn()
    public index: Index;

    @ManyToMany(() => Artist, { onDelete: "SET NULL" })
    public artists: Artist[];

    

}