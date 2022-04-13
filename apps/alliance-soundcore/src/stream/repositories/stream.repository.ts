import { EntityRepository, Repository } from "typeorm";
import { Stream } from "../entities/stream.entity";

@EntityRepository(Stream)
export class StreamRepository extends Repository<Stream> {}