import { Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Index } from "../../index/entities/index.entity";

@Entity()
export class Artwork {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @OneToOne(() => Index, { onDelete: "CASCADE" })
    @JoinColumn()
    public index: Index;

}