import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Mount } from "../entities/mount.entity";

@EntityRepository(Mount)
export class MountRepository extends PageableRepository<Mount> {}