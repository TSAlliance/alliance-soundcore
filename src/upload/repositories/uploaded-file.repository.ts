import { RestRepository } from "@tsalliance/rest";
import { EntityRepository } from "typeorm";
import { UploadedAudioFile } from "../entities/uploaded-file.entity";

@EntityRepository(UploadedAudioFile)
export class UploadedFileRepository extends RestRepository<UploadedAudioFile> {}