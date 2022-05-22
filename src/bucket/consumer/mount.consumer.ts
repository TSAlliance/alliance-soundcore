import fs from "node:fs";
import path from "node:path";
import glob from "glob";

import { InjectQueue, OnQueueActive, OnQueueCompleted, OnQueueError, OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bull";
import { StorageService } from "../../storage/storage.service";
import { MountedFile } from "../entities/mounted-file.entity";

import { IndexService } from "../../index/services/index.service";
import { Mount } from "../../mount/entities/mount.entity";
import { MountService } from "../../mount/services/mount.service";

export interface MountScanResult {
    totalTime: number;
    totalFiles: number;
    notIndexedFiles: number;
}

@Processor("mount-queue")
export class MountConsumer {
    private logger: Logger = new Logger(MountService.name);

    constructor(
        private mountService: MountService,
        private storageService: StorageService,
        // private gateway: MountGateway,
        private indexService: IndexService,
        @InjectQueue("mount-queue") private mountQueue: Queue<Mount>
    ) {}

    public async clearQueue() {
        return this.mountQueue.clean(0, "active")
            .then(() => this.mountQueue.clean(0, "completed"))
            .then(() => this.mountQueue.clean(0, "delayed"))
            .then(() => this.mountQueue.clean(0, "failed"))
            .then(() => this.mountQueue.clean(0, "paused"))
            .then(() => this.mountQueue.clean(0, "wait"))
    }

    @Process()
    public async scanMount(job: Job<Mount>): Promise<MountScanResult> {
        // Just for time calculations
        const start = Date.now();
        
        // Build directory path for mount
        const mountDirectory: string = await this.storageService.getMountPath(job.data);

        return new Promise((resolve, reject) => {
            // Create mount directory if not exists
            fs.mkdir(mountDirectory, { recursive: true }, (err) => {
                // Return on error
                if(err) {
                    reject(err)
                    console.error(err)
                    return;
                }

                // Scan mount directory
                glob("**/*.mp3", { cwd: mountDirectory }, (err: Error, matches: string[]) => {
                    job.update(job.data)

                    // Return on error
                    if(err) {
                        reject(err)
                        console.error(err)
                        return;
                    }

                    this.indexService.indexQueue.addBulk(matches.map((filepath) => {
                        const file = new MountedFile(path.dirname(filepath), path.basename(filepath), job.data);
                        return { data: file, opts: { jobId: file.bullJobId } }
                    })).then(() => {
                        resolve({ totalFiles: matches.length, totalTime: Date.now() - start, notIndexedFiles: 0 })
                    }).catch((error: Error) => {
                        console.error(error);
                        reject(error);
                    })
                })
            })
        })
    }

    @OnQueueError()
    public onError(err: Error) {
        if(err["code"] == "ECONNREFUSED") {
            this.logger.error(`Error on redis connection: ${err.message}`);
        } else {
            this.logger.error(err)
        }
    }

    @OnQueueActive()
    public onActive(job: Job<Mount>) {
        this.logger.verbose(`Scanning mount '${job.data.name}' for mp3 files.`);
    }

    @OnQueueFailed()
    public onFailed(job: Job<Mount>, err: Error) {
        this.logger.error(err);
    }

    @OnQueueCompleted()
    public onComplete(job: Job<Mount>, result: MountScanResult) {
        this.logger.verbose(`Scanned mount '${job.data.name}' in ${result?.totalTime || 0}ms. Found '${result?.totalFiles || 0}' files in total. '${result?.notIndexedFiles || 0}' files need to be indexed.`);
    }
}