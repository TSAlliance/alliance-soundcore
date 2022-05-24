import { Logger } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import { glob } from "glob";
import { MountScanResultDTO } from "../dtos/scan-result.dto";
import { Mount } from "../entities/mount.entity";
import { MountScan } from "../entities/scan.entity";

const logger = new Logger("MountScanner");

export default function (job: Job<MountScan>, cb: DoneCallback) {
    const startTime = new Date().getTime();
    const scan = job.data;
    const mount = scan?.mount;
    const pid = process.pid;

    try {
        if(!mount || !mount?.directory) {
            reportError(mount, new Error("Invalid mount or directory"), cb);
        } else {
            logger.verbose(`Scanning directory '${mount.directory}' on mount '${mount.name}'. PID: ${pid}`);

            glob("**/*.mp3", { cwd: mount.directory }, (err: Error, files: string[]) => {
                if(err) {
                    // Print error if exists
                    reportError(mount, err, cb);
                } else {
                    // Trigger callback to complete job
                    logger.verbose(`Scanned mount '${mount.name}'. Found ${files.length} files in ${new Date().getTime() - startTime}ms.`);
                    cb(null, new MountScanResultDTO(files, mount));
                }
            });
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
  