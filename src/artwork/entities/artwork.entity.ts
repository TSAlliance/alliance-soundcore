import { Entity, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Artwork {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

}