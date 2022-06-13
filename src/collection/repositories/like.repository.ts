import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Like } from "../entities/like.entity";

@EntityRepository(Like)
export class LikeRepository extends PageableRepository<Like> {}