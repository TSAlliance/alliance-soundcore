import { Logger } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import { glob } from "glob";
import fs from "fs";
import { MountScanResultDTO } from "../dtos/scan-result.dto";
import { Mount } from "../entities/mount.entity";
import { MountScan } from "../entities/scan.entity";
import { MountedFile } from "../../bucket/entities/mounted-file.entity";
import path from "path";
import { FileDTO } from "../dtos/file.dto";

const logger = new Logger("MountScanner");

export default function (job: Job<MountScan>, cb: DoneCallback) {
    const startTime = new Date().getTime();
    const scan = job.data;
    const mount = scan?.mount;
    const pid = process.pid;

    try {
        if(!mount) {
            reportError(mount, new Error("Invalid mount: null"), cb);
        } else {
            logger.verbose(`Scanning directory '${mount.directory}' on mount '${mount.name}'. PID: ${pid}`);
            
            if(!fs.existsSync(mount.directory)) {
                logger.warn(`Could not find directory '${mount.directory}'. Creating it...`);
                fs.mkdirSync(mount.directory, { recursive: true });
                logger.verbose(`Created directory '${mount.directory}'.`);
            }

            const files: FileDTO[] = [];
            const globs = glob("**/*.mp3", { cwd: mount.directory }, () => ({}));

            // Listen for match event
            // On every match, create a new object
            // for future processing
            globs.on("match", (match: string) => {
                files.push(new MountedFile(path.dirname(match), path.basename(match), mount));
            })

            // Listen for END event.
            // This will be triggered when matching process is done.
            globs.on("end", () => {                    
                logger.verbose(`Scanned mount '${mount.name}'. Found ${files.length} files in ${Date.now()-startTime}ms.`);
                cb(null, new MountScanResultDTO(files, mount));
            })

            // Listen for error event
            globs.on("error", (err: Error) => {
                reportError(mount, err, cb);
            })
        }
    } catch(err: any) {
        reportError(mount, err, cb);
    }
}

function reportError(context: Mount, error: Error, cb: DoneCallback) {
    logger.error(error.message, error.stack);
    logger.verbose(`Failed scanning mount '${context.name}': ${error.message}`);
    cb(error, []);
}
  