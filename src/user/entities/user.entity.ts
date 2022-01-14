import { SSOUser } from "@tsalliance/sso-nest";
import { Entity, OneToMany } from "typeorm";
import { Stream } from "../../stream/entities/stream.entity";

@Entity()
export class User extends SSOUser {

    @OneToMany(() => Stream, stream => stream.listener)
    public streams: Stream[];

}