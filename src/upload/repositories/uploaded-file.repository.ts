import { EntityRepository, Repository } from "typeorm";
import { UploadedFile } from "../entities/uploaded-file.entity";

@EntityRepository(UploadedFile)
export class UploadedFileRepository extends Repository<UploadedFile> {}