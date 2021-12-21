import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { StorageMount } from "../entities/storage-mount.entity";

@EntityRepository(StorageMount)
export class MountRepository extends PageableRepository<StorageMount> {}