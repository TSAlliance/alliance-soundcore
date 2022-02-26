import { OnQueueActive, OnQueueProgress, Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { Mount } from "../entities/mount.entity";
import { MountGateway } from "../gateway/mount-status.gateway";
import { MountService } from "../services/mount.service";

@Processor("index")
export class IndexConsumer {

    constructor(
        private mountService: MountService,
        private gateway: MountGateway
    ) {}

    @Process()
    public async scanMount(job: Job<Mount>) {
        
        return;
    }

    @OnQueueProgress()
    public onProgress(job: Job<Mount>)

    @OnQueueActive()
    public onActive(job: Job<Mount>) {
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