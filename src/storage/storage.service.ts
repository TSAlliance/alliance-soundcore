import os from "os"
import path from "path";
import crypto from "crypto"
import fs, { mkdirSync } from "fs"

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Readable } from "stream";
import { Index } from "../index/entities/index.entity";
import { Mount } from "../bucket/entities/mount.entity";
import { BUCKET_ID } from "../shared/shared.module";
import pathToFfmpeg from "ffmpeg-static";
import { execSync } from "child_process";
import { IndexStatus } from "../index/enum/index-status.enum";

@Injectable()
export class StorageService {
    private logger: Logger = new Logger(StorageService.name)

    constructor(@Inject(BUCKET_ID) private bucketId: string){}

    /**
     * Calculte checksum from index.
     * @param index Index to generate checksum for
     * @returns Index with new checksum
     */
    public async generateChecksumOfIndex(index: Index): Promise<Index> {
        return new Promise((resolve, reject) => {
            const filepath = this.buildFilepath(index.mount, index.filename);
            const hash = crypto.createHash('md5');
            const stream = Readable.from(fs.createReadStream(filepath))

            stream.on('error', reject);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('close', () => {
                index.checksum = hash.digest('hex');
                resolve(index)
            });
        })
    }

    /**
     * Write buffer to filesystem in the correct mount.
     * @param mount Mount to write file in
     * @param buffer Data to be written
     * @param filename Resulting filename
     */
    public async writeBufferToMount(mount: Mount, buffer: Buffer, filename: string): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.buildFilepath(mount, filename), buffer, (err) => {
                if(err) reject(err)
                else resolve()
            })
        })
    }

    /**
     * Write an optimized mp3 file.
     * @param index Index to optimize
     * @returns Index
     */
    public async createOptimizedMp3File(index: Index): Promise<Index> {
        const srcFilepath: string = path.join(index.mount.path, index.filename);
        const optimizedDir: string = this.getOptimizedDir(index.mount);
        const dstFilepath: string = path.join(optimizedDir, index.filename);

        if(!fs.existsSync(srcFilepath)) {
            index.status = IndexStatus.ERRORED;
            index.size = 0;
            throw new NotFoundException("Could not find src file to optimize");
        }

        mkdirSync(optimizedDir, { recursive: true })
        
        try {
            if(!fs.existsSync) {
                execSync(`${pathToFfmpeg} -i "${srcFilepath}" -vn -filter:a loudnorm -filter:a "volume=4" -ac 2 -b:a 192k "${dstFilepath}"`, { stdio: "pipe" });
            }

            if(!fs.existsSync(dstFilepath)) {
                index.status = IndexStatus.ERRORED;
                index.size = 0;
            } else {
                index.status = IndexStatus.PROCESSING;
                index.size = (await this.getFileStats(dstFilepath)).size;
            }
        } catch (error) {
            this.logger.error(error)

            index.status = IndexStatus.ERRORED;
            index.size = 0;
        }

        return index;
    }

    /**
     * Get the full path to a file within mount.
     * @param mount Corresponding mount
     * @param filename Filename
     * @returns string
     */
    public buildFilepath(mount: Mount, filename: string): string {
        return path.join(mount.path, filename);
    }

    /**
     * Get the main config directory of the application.
     * @returns string
     */
    public getSoundcoreDir(): string {
        return path.join(os.homedir(), ".soundcore");
    }

    /**
     * Get optimized directory of a mount that contains all optimized mp3 files
     * @returns string
     */
     public getOptimizedDir(mount?: Mount): string {
        if(!mount) return path.join(this.getSoundcoreDir(), this.bucketId);
        return path.join(mount.path, "optimized");
    }

    /**
     * Get file stats of a file
     * @param filepath Path to the file
     * @returns fs.Stats
     */
    public async getFileStats(filepath: string): Promise<fs.Stats> {
        return new Promise((resolve) => {
            fs.stat(filepath, (err, stats) => {
                if(err) resolve(null)
                else resolve(stats)
            })
        })
    }

    

}
