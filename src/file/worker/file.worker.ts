import { Logger } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import pathfs from "path";
import { FileProcessDTO } from "../dto/file-process.dto";
import { TYPEORM_CONNECTION_FILEWORKER } from "../../constants";
import { File } from "../entities/file.entity";
import { Mount } from "../../mount/entities/mount.entity";
import { Bucket } from "../../bucket/entities/bucket.entity";
import { FileRepository } from "../repositories/file.repository";
import { DBWorker } from "../../utils/workers/worker.util";

const logger = new Logger("FileProcessor")

export default function (job: Job<FileProcessDTO>, cb: DoneCallback) {    
    const startTime = Date.now();

    const file = job.data.file;
    const mount = job.data.file.mount;
    const path = pathfs.join(file.mount.directory, file.directory || ".", file.filename);

    logger.verbose(`Started processing file '${path}'`);

    DBWorker.getInstance().establishConnection(TYPEORM_CONNECTION_FILEWORKER, job.data.workerOptions, [ File, Mount, Bucket ]).then((connection) => {
        const repository = connection.getCustomRepository(FileRepository);

        repository.count().then((n) => {
            console.log(n);

            reportSuccess(startTime, job, null, cb);
        })

        //const repository = connection.getRepository(File)
        //console.log(repository);

        // const entityManager = connection.createEntityManager();
        //entityManager.findOne(File, {  }).then((f) => console.log(f)).catch((error) => console.log(error));
        // console.log(entityManager.connection.name);

    }).catch((error: Error) => {
        // Handle error
        reportError(job, error, cb);
    })
}

/**
 * Report success by calling the DoneCallback.
 * @param startTime Time in ms when the job was started.
 * @param job Job data
 * @param result Result to be passed to DoneCallback
 * @param cb DoneCallback
 */
function reportSuccess(startTime: number, job: Job<FileProcessDTO>, result: any, cb: DoneCallback) {
    const file = job.data.file;
    const path = pathfs.join(file.mount.directory, file.directory, file.filename);

    logger.verbose(`Processed file '${path}' in ${Date.now()-startTime}ms.`);
    cb(null, result);
}

/**
 * Report the error to the log.
 * This will create log entries as well as execute the DoneCallback
 * passing in the error and null as the job's result.
 * @param job Job where the error occured
 * @param error Error that has occured
 * @param cb DoneCallback
 */
 function reportError(job: Job<FileProcessDTO>, error: Error, cb: DoneCallback) {
    const file = job.data.file
    const path = pathfs.join(file.mount.directory, file.directory, file.filename);

    logger.error(`Failed processing file '${path}': ${error.message}`);
    console.error(error);
    cb(error, null);
}