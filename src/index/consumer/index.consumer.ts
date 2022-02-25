import { OnGlobalQueueError, OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { IndexReportService } from "../../index-report/services/index-report.service";
import { Index } from "../entities/index.entity";
import { IndexService } from "../services/index.service";

@Processor("index")
export class IndexConsumer {

    constructor(
        private indexService: IndexService,
        private indexReportService: IndexReportService
    ) {}

    @Process()
    public async transcode(job: Job<Index>) {
        return await this.indexService.processIndex(job.data)
    }

    @OnQueueActive()
    public onActive(job: Job<Index>) {
        console.log("Now processing file " + job.data.filename);
    }

    @OnQueueFailed()
    public onFailed(job: Job<Index>, err: Error) {
        if(err && job?.data) {
            this.indexService.setError(job.data, err);
            this.indexReportService.appendStackTrace(job.data.report, err.message, err.stack)
            console.log(err)
        }
    }

    @OnGlobalQueueError()
    public onError(error: Error) {
        console.error(error)
    }

    @OnQueueCompleted()
    public onComplete(job: Job<Index>, result: any) {
        //
        console.log("completed")
    }
}