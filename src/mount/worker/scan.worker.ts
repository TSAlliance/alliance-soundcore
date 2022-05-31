import { Logger } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import { glob } from "glob";
import fs from "fs";
import { Mount } from "../entities/mount.entity";
import { MountedFile } from "../../bucket/entities/mounted-file.entity";
import path from "path";
import { FileDTO } from "../dtos/file.dto";
import { MountScanProcessDTO } from "../dtos/mount-scan.dto";
import { DBWorker } from "../../utils/workers/worker.util";
import { TYPEORM_CONNECTION_SCANWORKER } from "../../constants";
import { MountScanResultDTO } from "../dtos/scan-result.dto";
import { File } from "../../file/entities/file.entity";
import { Bucket } from "../../bucket/entities/bucket.entity";

const logger = new Logger("MountScanner");

export default function (job: Job<MountScanProcessDTO>, dc: DoneCallback) {
    const startTime = new Date().getTime();
    const scan = job.data;
    const mount = scan?.mount;
    const pid = process.pid;    

    try {
        if(!mount) {
            reportError(mount, new Error("Invalid mount: null"), dc);
        } else {
            logger.debug(`[${mount.name}] Gathering information on previously scanned files...`);

            // Establish database connection
            DBWorker.getInstance().establishConnection(TYPEORM_CONNECTION_SCANWORKER, job.data.workerOptions, [ File, Bucket, Mount ]).then((connection) => {
                const repository = connection.getRepository(File);

                repository.find({ where: { mount: { id: mount.id }}, select: ["name", "directory"]}).then((existingFiles) => {
                    preventStall(job);

                    logger.debug(`[${mount.name}] Found ${existingFiles.length} files in database.`);

                    if(!fs.existsSync(mount.directory)) {
                        logger.warn(`Could not find directory '${mount.directory}'. Creating it...`);
                        fs.mkdirSync(mount.directory, { recursive: true });
                        logger.verbose(`Created directory '${mount.directory}'.`);
                    }

                    scanMount(pid, job, existingFiles).then((result) => {
                        reportSuccess(startTime, job, result, dc);
                    }).catch((error) => {
                        reportError(mount, error, dc);
                    })
                }).catch((error) => {
                    reportError(mount, error, dc);
                })
            })
        }
    } catch(err: any) {
        reportError(mount, err, dc);
    }
}

function scanMount(pid: number, job: Job<MountScanProcessDTO>, exclude: File[]): Promise<MountScanResultDTO> {
    return new Promise((resolve, reject) => {
        const mount = job.data.mount;
        const startTime = Date.now();

        // Set an interval that periodically updates the job in queue.
        // This causes the job not be considered stalled.
        const interval = setInterval(() => preventStall(job), 2000);

        logger.debug(`[${mount.name}] Building exclude list using ${exclude.length} files...`);
        const excludeList: string[] = [];
        for(let i = 0; i < exclude.length; i++) {
            excludeList.push(path.join(exclude[i].directory, exclude[i].name));
            // excludeList.push(path.join(mount.directory, exclude[i].directory, exclude[i].name));
        }

        console.log(excludeList);

        logger.debug(`[${mount.name}] Building exclude list took ${Date.now()-startTime}ms.`);
        logger.log(`Scanning directory '${mount.directory}' on mount '${mount.name}'. PID: ${pid}`);

        const files: FileDTO[] = [];
        const globs = glob("**/*.mp3", { ignore: excludeList, cwd: mount.directory }, () => ({}));

        // Listen for match event
        // On every match, create a new object
        // for future processing
        globs.on("match", (match: string) => {
            files.push(new MountedFile(path.dirname(match), path.basename(match), mount));
        })

        // Listen for END event.
        // This will be triggered when matching process is done.
        globs.on("end", () => { 
            clearInterval(interval);                   
            resolve(new MountScanResultDTO(files));
        })

        // Listen for error event
        globs.on("error", (err: Error) => {
            reject(err);
        })
    })
}

function preventStall(job: Job<MountScanProcessDTO>) {
    // Prevent job from being considered as stalled
    job.update(job.data);
}

function reportSuccess(startTime: number, job: Job<MountScanProcessDTO>, result: MountScanResultDTO, dc: DoneCallback) {
    logger.log(`Scanned mount '${job.data.mount.name}'. Found ${result.files.length} files in ${Date.now()-startTime}ms.`);
    dc(null, result);
}

function reportError(context: Mount, error: Error, dc: DoneCallback) {
    logger.error(error.message, error.stack);
    logger.error(`Failed scanning mount '${context.name}': ${error.message}`);
    dc(error, []);
}
  