import { Injectable, Logger } from "@nestjs/common";
import { Index } from "../entities/index.entity";
import { IndexReport } from "../entities/report.entity";
import { IndexReportRepository } from "../repositories/index-report.repository";

@Injectable()
export class IndexReportService {
    private logger: Logger = new Logger(IndexReportService.name);

    constructor(
        private indexReportRepository: IndexReportRepository
    ) {}

    /**
     * Create blank report for an index. This overwrites all existing reports.
     * @param index 
     * @returns 
     */
    public async createBlank(index: Index): Promise<IndexReport> {
        await this.indexReportRepository.delete({ index })

        return this.indexReportRepository.save({
            index: index,
            jsonContents: []
        }).catch((reason) => {
            this.logger.error(`Could not create blank report for Index '${index.id}': `, reason);
            return null;
        })
    }

    /**
     * Find a report by its id.
     * @param reportId Report's id
     * @returns IndexReport
     */
    public async findById(reportId: string): Promise<IndexReport> {
        return this.indexReportRepository.findOne({ where: { id: reportId }})
    }

}