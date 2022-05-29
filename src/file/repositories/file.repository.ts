import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { File } from "../entities/file.entity";

@EntityRepository(File)
export class FileRepository extends PageableRepository<File> {}