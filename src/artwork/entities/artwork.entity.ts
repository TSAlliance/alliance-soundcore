import { CanRead } from "@tsalliance/sso-nest";
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Index } from "../../index/entities/index.entity";

@Entity()
export class Artwork {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Column({ default: false })
    public external: boolean;

    @Column({ nullable: true })
    public externalUrl: string;

    @CanRead(false)
    @OneToOne(() => Index, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    public index: Index;

}