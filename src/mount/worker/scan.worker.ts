import { Logger } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import { glob } from "glob";
import { Mount } from "../entities/mount.entity";

const logger = new Logger("");

export default function (job: Job<Mount>, cb: DoneCallback) {
    const startTime = new Date().getTime();
    const mount = job.data;
    const pid = process.pid;
    
    logger.verbose(`Scanning directory '${mount.directory}' on mount '${mount.name}'. PID: ${pid}`);

    glob("./*/**.mp3", { cwd: mount.directory }, (err: Error, files: string[]) => {
        if(err) {
            // Print error if exists
            logger.error(err.message, err.stack, err.name);
        } else {
            // Handle results
            console.log(files);
        }
        
        // Trigger callback to complete job
        logger.verbose(`Scanned mount '${mount.name}'. Took ${new Date().getTime() - startTime}ms.`);
        cb(null, mount);
    });
}
  