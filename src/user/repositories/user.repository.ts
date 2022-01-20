import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { User } from "../entities/user.entity";

@EntityRepository(User)
export class UserRepository extends PageableRepository<User> {}