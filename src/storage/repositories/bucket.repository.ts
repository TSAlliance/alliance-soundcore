import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { StorageBucket } from "../entities/storage-bucket.entity";

@EntityRepository(StorageBucket)
export class BucketRepository extends PageableRepository<StorageBucket> {}