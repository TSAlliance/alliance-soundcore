import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Publisher } from "../entities/publisher.entity";

@EntityRepository(Publisher)
export class PublisherRepository extends PageableRepository<Publisher> {}