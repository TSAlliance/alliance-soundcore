import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Bucket } from "../entities/bucket.entity";

@EntityRepository(Bucket)
export class BucketRepository extends PageableRepository<Bucket> {}