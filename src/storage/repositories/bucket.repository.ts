import { EntityRepository, Repository } from "typeorm";
import { StorageBucket } from "../entities/storage-bucket.entity";

@EntityRepository(StorageBucket)
export class BucketRepository extends Repository<StorageBucket> {}