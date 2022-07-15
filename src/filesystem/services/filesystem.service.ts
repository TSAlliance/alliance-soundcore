import os from "os"
import path from "path";
import fs from "fs"

import { Injectable, Logger } from '@nestjs/common';

import { v4 as uuidv4 } from "uuid"
import { File } from "../../file/entities/file.entity";
import { Mount } from "../../mount/entities/mount.entity";
import { SC_ARTWORKDIR_NAME, SC_IDFILE_NAME } from "../filesystem.module";
import { RandomUtil } from "@tsalliance/rest";

@Injectable()
export class FileSystemService {
    private readonly _logger: Logger = new Logger("FileSystem");
    private readonly _instanceId = this.readOrCreateInstanceId();

    /**
     * Get the instance id of the current application.
     * @returns {string} Instance id
     */
    public getInstanceId(): string {
        return this._instanceId;
    }

    /**
     * Get the main config directory of the application.
     * @returns {string} Root directory path
     */
    public getInstanceDir(): string {
        return path.join(os.homedir(), ".soundcore");
    }

    /**
     * Get temporary directory of the application.
     * @returns {string} Filepath to temporary directory
     */
    public getTmpDir(): string {
        return path.join(os.tmpdir());
    }

    /**
     * Create a new temporary filepath to 
     * store a temporary file.
     * @param {string} (Optional) Filename for the temporary file
     * @returns {string} Filepath to temporary file
     */
    public createTmpPath(filename?: string): string {
        return path.join(os.tmpdir(), filename || uuidv4());
    }

    /**
     * Get absolute path of a mount object.
     * @param {Mount} mount Mount object
     * @returns {string} Absolute filepath to mount directory
     */
    public resolveMountPath(mount: Mount): string {
        if(typeof mount === "undefined" || mount == null) {
            throw new Error(`Valid mount object required on file object in order to resolve absolute path of the file. Found: ${typeof mount === "undefined"}`);
        }
        return path.resolve(mount.directory);
    }

    /**
     * Get artworks directory of a mount that contains all cover images
     * @returns {string} Absolute filepath of artwork directory in mount
     */
    public resolveArtworkDir(mount: Mount): string {
        return path.join(this.resolveMountPath(mount), SC_ARTWORKDIR_NAME);
    }

    /**
     * Resolve the filepath for a given string or file object.
     * @param {string | File} filepathOrFile Filepath or File object
     * @returns {string} Resolved absolute filepath
     */
    public resolveFilepath(filepathOrFile: string | File): string {
        if(typeof filepathOrFile == "undefined" || filepathOrFile == null) {
            throw new Error(`Parameter cannot be nullish in order to resolve the absolute filepath.`);
        }

        if(typeof filepathOrFile === "string") {
            return path.resolve(filepathOrFile);
        }

        const file = filepathOrFile as File;
        return path.join(this.resolveMountPath(file.mount), file.directory, file.name);
    }

    /**
     * Get file stats of a file
     * @param filepathOrFile Filepath or File object
     * @returns {fs.Stats} Filestats object
     */
    public async stats(filepathOrFile: string | File): Promise<fs.Stats> {
        return new Promise((resolve, reject) => {
            try {
                fs.stat(this.resolveFilepath(filepathOrFile), (err, stats) => {
                    if(err) reject(err);
                    else resolve(stats);
                })
            } catch (err) {
                reject(err);
            }
        })
    }

    /**
     * Read the instance id saved to the instance's folder.
     * If no id exists, a new one is generated and saved
     * to the file.
     */
    private readOrCreateInstanceId(): string {
        const filepath = path.join(this.getInstanceDir(), SC_IDFILE_NAME);
        let instanceId: string;

        // If instanceId file does not already exist:
        // - Generate random string as instance id
        // - Create new file and write id into it
        // - Return instanceId and skip file read
        if(!fs.existsSync(filepath)) {
            this._logger.warn(`Could not find file ${SC_IDFILE_NAME}. Creating new instance id.`);
            instanceId = RandomUtil.randomString(36);
            fs.writeFileSync(filepath, instanceId, { encoding: "utf-8" });
            return instanceId;
        } else {
            // Read file into buffer and
            // return string from that buffer.
            const buffer = fs.readFileSync(filepath, { encoding: "utf-8" });
            instanceId = buffer.toString();
        }

        this._logger.log(`ID of this instance is '${instanceId}'`);
        return instanceId;
    }
}
