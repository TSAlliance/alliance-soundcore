import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Index } from "../entities/index.entity";

@EntityRepository(Index)
export class IndexRepository extends PageableRepository<Index> {}