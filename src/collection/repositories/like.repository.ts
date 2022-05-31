import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { LikedResource } from "../entities/like.entity";

@EntityRepository(LikedResource)
export class LikeRepository extends PageableRepository<LikedResource> {}