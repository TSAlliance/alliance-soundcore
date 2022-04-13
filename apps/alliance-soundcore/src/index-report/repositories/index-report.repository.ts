import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { IndexReport } from "../entities/report.entity";

@EntityRepository(IndexReport)
export class IndexReportRepository extends PageableRepository<IndexReport> {}