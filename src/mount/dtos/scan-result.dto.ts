import { FileDTO } from "./file.dto";
import { MountScanReportDTO } from "./scan-report.dto";

export class MountScanResultDTO {

    constructor(
        public readonly files: FileDTO[],
        public readonly report: MountScanReportDTO
    ) {}

}