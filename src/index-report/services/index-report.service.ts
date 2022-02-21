import { Injectable, Logger } from "@nestjs/common";
import { In } from "typeorm";
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
        return this.createMultiple([index])[0];
    }

    public async createMultiple(indices: Index[]): Promise<IndexReport[]> {
        const reports: IndexReport[] = [];

        for(const index of indices) {
            const report = new IndexReport();
            report.index = index;
            report.jsonContents = [
                { timestamp: Date.now(), status: "info", message: `Report created for index '${index.id}'.` }
            ]
            reports.push(report);
        }

        await this.indexReportRepository.delete({ index: { id: In(reports.map((report) => report.index.id)) }});
        return this.indexReportRepository.save(reports).catch((error) => {
            console.error(error)
            return []
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
     public async appendWarn(report: IndexReport, message: string, context?: Record<string, any>) {
        await this.appendElement([report], {
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
    public async appendInfo(report: IndexReport, message: string, context?: Record<string, any>) {
        await this.appendElement([report], {
            message,
            status: "info",
            context
        })
    }

    public async appendInfoMultiple(report: IndexReport[], message: string, context?: Record<string, any>) {
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
    public async appendError(report: IndexReport, message: string, context?: Record<string, any>) {
        await this.appendElement([report], {
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
     public async appendStackTrace(report: IndexReport, message: string, stack: string, context?: Record<string, any>) {
        await this.appendElement([report], {
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
    public async appendElement(reports: IndexReport[], reportElement: { status: "info" | "warn" | "error", message: string, stack?: string, context?: Record<string, any> }) {
        if(!reports || reports.length <= 0) return;

        for(const report of reports) {
            if(!report) return;
            const element = new IndexReportElement();
            element.timestamp = Date.now();
            element.status = reportElement.status || "info";
            element.message = reportElement.message;
            element.stack = reportElement.stack;
            element.context = reportElement.context;

            report.jsonContents.push(element);
        }
        await this.indexReportRepository.save(reports).catch((reason) => {
            console.error(reason)
        });
    }

}