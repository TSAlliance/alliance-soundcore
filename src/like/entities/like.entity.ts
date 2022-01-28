import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, TableInheritance } from "typeorm";
import { User } from "../../user/entities/user.entity";

@Entity()
@TableInheritance({ column: { type: "varchar", name: "type" }})
export class Liked {

    @PrimaryGeneratedColumn("uuid")
    public id: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn()
    public user: User;

    @CreateDateColumn()
    public likedAt: Date;


}