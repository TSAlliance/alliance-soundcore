import os from "os"
import path from "path";
import fs from "fs"

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Mount } from "../mount/entities/mount.entity";
import { BUCKET_ID } from "../shared/shared.module";

import { v4 as uuidv4 } from "uuid"
import { File } from "../file/entities/file.entity";

@Injectable()
export class StorageService {
    private logger: Logger = new Logger(StorageService.name)

    constructor(@Inject(BUCKET_ID) private bucketId: string){}

    /**
     * Write buffer to filesystem in the correct mount.
     * @param mount Mount to write file in
     * @param buffer Data to be written
     * @param filename Resulting filename
     */
    // public async writeBufferToMount(mount: Mount, buffer: Buffer, filename: string): Promise<void> {
    //     return new Promise((resolve, reject) => {
    //         fs.writeFile(this.buildFilepathNonIndex(new MountedFile(null, filename, mount)), buffer, (err) => {
    //             if(err) reject(err)
    //             else resolve()
    //         })
    //     })
    // }

    /**
     * Write an optimized mp3 file.
     * @param index Index to optimize
     * @returns Index
     */
    public async createOptimizedMp3File(index: any): Promise<any> {
        return null;
        // const srcFilepath: string = this.buildFilepath(index);
        // // const optimizedDir: string = this.getOptimizedDir(index.mount);
        // // const dstFilepath: string = path.join(optimizedDir, index.filename);

        // if(!fs.existsSync(srcFilepath)) {
        //     index.status = 0;
        //     index.size = 0;
        //     throw new NotFoundException("Could not find src file to optimize");
        // }

        // // mkdirSync(optimizedDir, { recursive: true })
        
        // try {
        //     // if(!fs.existsSync(dstFilepath)) {
        //         // The following ffmpeg command causes overdriven bass.
        //         // execSync(`${pathToFfmpeg} -i "${srcFilepath}" "${dstFilepath}"`, { stdio: "pipe" });
        //     // }

        //     // Only needed if above is not commented out
        //     /*if(!fs.existsSync(dstFilepath)) {
        //         index.status = IndexStatus.ERRORED;
        //         index.size = 0;
        //     } else {*/
        //         index.status = 0;
        //         // index.size = (await this.getFileStats(dstFilepath)).size;
        //         index.size = (await this.getFileStats(srcFilepath))?.size || 0;
        //     // }
        // } catch (error) {
        //     this.logger.error(error)

        //     index.status = 0;
        //     index.size = 0;
        // }

        // return index;
    }

    /**
     * Get the full path to a file within mount.
     * @param file File database entry (NOTE: Must have mount object set)
     * @returns string - Absolute filepath on filesystem
     */
    public buildAbsoluteFilepath(file: File): string {
        if(!file.mount) throw new Error("File does not have valid mount object.");
        return path.join(file.mount.directory, file.directory, file.name);
    }

    public getMountPath(mount: Mount): string {
        return path.join(mount.directory);
    }

    /**
     * Get the full path to a file within mount.
     * @param mount Corresponding mount
     * @param filename Filename
     * @returns string
     */
     public buildFilepathNonIndex(file: any): string {
        // return path.join(file.mount.directory, file.directory || ".", file.filename);
        return ""
    }

    /**
     * Get the full path to a file within mount.
     * @param mount Corresponding mount
     * @param filename Filename
     * @returns string
     */
     public buildOptimizedFilepath(mount: Mount, filename: string): string {
        return path.join(this.getOptimizedDir(mount), filename);
    }

    /**
     * Get the main config directory of the application.
     * @returns string
     */
    public getSoundcoreDir(): string {
        return path.join(os.homedir(), ".soundcore");
    }

    /**
     * Get temporary directory of the application.
     * @returns string
     */
    public getTmpDir(): string {
        return path.join(os.tmpdir());
    }

    /**
     * Get temporary filepath for a file.
     * @returns string
     */
     public buildTmpFilepath(): string {
        return path.join(os.tmpdir(), uuidv4());
    }

    /**
     * Get optimized directory of a mount that contains all optimized mp3 files
     * @returns string
     */
    public getOptimizedDir(mount?: Mount): string {
        if(!mount) return path.join(this.getSoundcoreDir(), this.bucketId, "optimized");
        return path.join(mount.directory, "optimized");
    }

    /**
     * Get artworks directory of a mount that contains all cover images
     * @returns string
     */
    public getArtworksDir(mount?: Mount): string {
        if(!mount) return path.join(this.getSoundcoreDir(), this.bucketId, "artworks");
        return path.join(mount.directory, "artworks");
    }

    /**
     * Get file stats of a file
     * @param filepath Path to the file
     * @returns fs.Stats
     */
    public async getFileStats(filepath: string): Promise<fs.Stats> {
        return new Promise((resolve, reject) => {
            fs.stat(filepath, (err, stats) => {
                if(err) reject(err);
                else resolve(stats);
            })
        })
    }

    

}
