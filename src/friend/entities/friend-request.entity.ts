import { CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../user/entities/user.entity";

@Entity()
export class FriendRequest {

    @PrimaryGeneratedColumn()
    public id: string;

    @ManyToOne(() => User)
    public requester: User;

    @ManyToOne(() => User)
    public target: User;

    @CreateDateColumn()
    public createdAt: Date;

}