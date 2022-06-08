import { Logger } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import { TYPEORM_CONNECTION_GENERAL } from "../../constants";
import { DBWorker } from "../../utils/workers/worker.util";
import { GeniusProcessDTO } from "../dtos/genius-process.dto";

const logger = new Logger("GeniusWorker");

export default function (job: Job, dc: DoneCallback) {
    const startTime = Date.now();

    DBWorker.instance().then((worker) => {
        worker.establishConnection(TYPEORM_CONNECTION_GENERAL).then((connection) => {
        
            reportSuccess(startTime, job, null, dc);
        }).catch((error) => {
            reportError(error, job, dc);
        })
    })
}

function reportSuccess(startTime: number, job: Job<GeniusProcessDTO>, result: any, dc: DoneCallback) {
    // logger.log(`Scanned mount '${job.data.mount.name}'. Found ${result.report.totalFiles} files in total. ${result.report.newFiles} Files need to be processed. Took ${Date.now()-startTime}ms`);
    dc(null, result);
}

function reportError(error: Error, job: Job<GeniusProcessDTO>, dc: DoneCallback) {
    logger.error(error.message, error.stack);
    //logger.error(`Failed scanning mount '${context.name}': ${error.message}`);
    dc(error, []);
}