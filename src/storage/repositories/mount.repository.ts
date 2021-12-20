import { EntityRepository, Repository } from "typeorm";
import { StorageMount } from "../entities/storage-mount.entity";

@EntityRepository(StorageMount)
export class MountRepository extends Repository<StorageMount> {}