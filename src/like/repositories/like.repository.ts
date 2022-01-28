import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Liked } from "../entities/like.entity";

@EntityRepository(Liked)
export class LikeRepository extends PageableRepository<Liked> {}