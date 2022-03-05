import fs from "node:fs";

import { InjectQueue, OnQueueActive, OnQueueCompleted, OnQueueError, OnQueueFailed, OnQueueProgress, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bull";
import { StorageService } from "../../storage/storage.service";
import { Mount } from "../entities/mount.entity";
import { MountGateway } from "../gateway/mount-status.gateway";
import { MountService } from "../services/mount.service";
import { MountedFile } from "../entities/mounted-file.entity";
import glob from "glob";
import path from "node:path";
import { IndexService } from "../../index/services/index.service";

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
        private gateway: MountGateway,
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

        if(!fs.existsSync(mountDirectory)) {
            this.logger.warn(`Directory for mount '${job.data.name}' not found. Was looking for: ${mountDirectory}. Creating it...`);
            fs.mkdirSync(mountDirectory, { recursive: true })
        }

        // Scan files inside mount.
        // This also considers every file in subdirectories.
        const files: MountedFile[] = glob.sync("**/*.mp3", { cwd: mountDirectory }).map((filepath) => {
            const file = new MountedFile(path.dirname(filepath), path.basename(filepath), job.data);
            return file;
        });

        const existingIndices = await this.indexService.findIdsByMountedFiles(files);
        const notIndexedFiles: MountedFile[] = [];
        const filesLength = files.length;
        let i = 0;

        while(i < filesLength) {
            const file = files[i];
            const index = existingIndices.findIndex((index) => index.fullPath == file.fullPath);

            if(index == null || typeof index == "undefined" || index == -1) {
                // console.log(file.fullPath)
                notIndexedFiles.push(file)
            } else {
                // Remove from array, so we shrink the search range
                existingIndices.splice(index, 1);
            }

            i++;
        }

        return this.indexService.indexQueue.addBulk(notIndexedFiles.map((file) => {
            return { data: file, opts: { jobId: file.bullJobId } }
        })).then(() => {
            return { totalFiles: files.length, totalTime: Date.now() - start, notIndexedFiles: notIndexedFiles.length };
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

    @OnQueueProgress()
    public onProgress(job: Job<Mount>) {
        // TODO
    }
}