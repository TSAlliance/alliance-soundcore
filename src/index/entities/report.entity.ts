import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Index } from "./index.entity";

@Entity()
export class IndexReport {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @OneToOne(() => Index, { onDelete: "CASCADE" })
    @JoinColumn()
    public index: Index;

    @Column({ nullable: true, type: "json" })
    public jsonContents: IndexReportElement[];

    @CreateDateColumn()
    public createdAt: Date;

    @UpdateDateColumn()
    public updatedAt: Date;

}

export class IndexReportElement {

    public timestamp: number = Date.now();
    public status: "info" | "warn" | "error" = "info";
    public message: string;

}