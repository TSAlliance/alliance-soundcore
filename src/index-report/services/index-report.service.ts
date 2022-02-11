import { Injectable, Logger } from "@nestjs/common";
import { Index } from "../../index/entities/index.entity";
import { IndexReport, IndexReportElement } from "../entities/report.entity";
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
        await this.indexReportRepository.delete({ index: { id: index?.id } })

        return this.indexReportRepository.save({
            index: index,
            jsonContents: [
                { timestamp: Date.now(), status: "info", message: `Report created for index '${index.id}'.` }
            ]
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
        return this.indexReportRepository.findOne({ where: { id: reportId }, relations: ["index"]})
    }

    /**
     * Find a report by its indexe's id.
     * @param reportId Report's id
     * @returns IndexReport
     */
     public async findByIndexId(indexId: string): Promise<IndexReport> {
        return this.indexReportRepository.findOne({ where: { index: { id: indexId } }, relations: ["index"]})
    }

    /**
     * Add a new element to the report containing a timestamp, log level info and the corresponding message.
     * @param report Report id or report entity
     * @param reportElement Element to be appended
     */
     public async appendWarn(report: string | IndexReport, message: string, context?: Record<string, any>) {
        await this.appendElement(report, {
            message,
            status: "warn",
            context
        })
    }

    /**
     * Add a new element to the report containing a timestamp, log level info and the corresponding message.
     * @param report Report id or report entity
     * @param reportElement Element to be appended
     */
     public async appendInfo(report: string | IndexReport, message: string, context?: Record<string, any>) {
        await this.appendElement(report, {
            message,
            status: "info",
            context
        })
    }

    /**
     * Add a new element to the report containing a timestamp, log level info and the corresponding message.
     * @param report Report id or report entity
     * @param reportElement Element to be appended
     */
    public async appendError(report: string | IndexReport, message: string, context?: Record<string, any>) {
        await this.appendElement(report, {
            message,
            status: "error",
            context
        })
    }

    /**
     * Add a new element to the report containing a timestamp, log level info and the corresponding message.
     * @param report Report id or report entity
     * @param reportElement Element to be appended
     */
     public async appendStackTrace(report: string | IndexReport, message: string, stack: string, context?: Record<string, any>) {
        await this.appendElement(report, {
            message,
            status: "error",
            stack,
            context
        })
    }

    /**
     * Add a new element to the report containing a timestamp, log level info and the corresponding message.
     * @param report Report id or report entity
     * @param reportElement Element to be appended
     */
    public async appendElement(report: string | IndexReport, reportElement: { status: "info" | "warn" | "error", message: string, stack?: string, context?: Record<string, any> }) {
        let reportEntity: IndexReport = report as IndexReport;
        if(typeof report == "string") {
            reportEntity = await this.findById(report);
        }

        const element = new IndexReportElement();
        element.timestamp = Date.now();
        element.status = reportElement.status || "info";
        element.message = reportElement.message;
        element.stack = reportElement.stack;
        element.context = reportElement.context;

        reportEntity.jsonContents.push(element);
        await this.indexReportRepository.save(reportEntity).catch((reason) => {
            console.error(reason)
        });
    }

}