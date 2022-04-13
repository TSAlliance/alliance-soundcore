import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Distributor } from "../entities/distributor.entity";

@EntityRepository(Distributor)
export class DistributorRepository extends PageableRepository<Distributor> {}