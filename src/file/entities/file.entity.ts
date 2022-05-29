import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Mount } from "../../mount/entities/mount.entity";
import { FileFlag } from "../enums/file-flag.enum";

@Entity()
export class File {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @Index({ unique: false })
    @Column()
    public name: string;

    @Index({ unique: false })
    @Column({ nullable: true, default: "." })
    public directory: string;

    @Column({ nullable: true, default: 0 })
    public size: number;

    @Column({ type: "tinyint", nullable: true, default: 1 })
    public flag: FileFlag

    @ManyToOne(() => Mount)
    public mount: Mount;

}