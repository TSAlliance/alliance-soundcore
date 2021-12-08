import { EntityRepository, Repository } from "typeorm";
import { UploadedAudioFile } from "../entities/uploaded-file.entity";

@EntityRepository(UploadedAudioFile)
export class UploadedFileRepository extends Repository<UploadedAudioFile> {}