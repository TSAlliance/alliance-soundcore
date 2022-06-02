import { Logger } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import path from "path";
import fs from "fs";
import { ArtworkProcessDTO } from "../dtos/artwork-process.dto";
import { Artwork } from "../entities/artwork.entity";
import { ArtworkStorageHelper } from "../helper/artwork-storage.helper";
import sharp from "sharp";

const logger: Logger = new Logger("ArtworkWorker");
const storageHelper = new ArtworkStorageHelper();

export default function (job: Job<ArtworkProcessDTO>, dc: DoneCallback) {
    const artwork = job.data.artwork;
    const srcFile = job.data.sourceFile;
    const dstFile = storageHelper.findArtworkFilepath(artwork);

    // Check if the source file can be accessed by the process.
    fs.access(srcFile, (err) => {
        if(err) {
            logger.warn(`Could not write artwork to disk: Source could not be read: ${err.message}`);
            reportError(job, err, dc);
            return;
        }

        // Create destination directory
        fs.mkdir(path.basename(dstFile), { recursive: true }, (err, directory) => {
            if(err) {
                logger.warn(`Could not write artwork to disk: Could not create directory '${directory}': ${err.message}`);
                reportError(job, err, dc);
                return;
            }

            // Read source file into buffer and convert to jpeg,
            // compress and resize it. This will write the result into dstFile path
            sharp(srcFile).jpeg({ force: true, quality: 90, chromaSubsampling: "4:4:4" }).resize(512, 512, { fit: "cover" }).toFile(dstFile, (err, info) => {
                if(err) {
                    logger.warn(`Could not write artwork to disk: Failed while processing using sharp: ${err.message}`);
                    reportError(job, err, dc);
                    return;
                }

                reportSuccess(artwork, dc);
            })
        })
    })

    dc(null, {});
}

/**
 * Report success by calling the DoneCallback.
 * @param result Result to be passed to DoneCallback
 * @param cb DoneCallback
 */
function reportSuccess(result: Artwork, dc: DoneCallback) {
    dc(null, result);
}

/**
 * Report the error to the log.
 * This will create log entries as well as execute the DoneCallback
 * passing in the error and null as the job's result.
 * @param job Job where the error occured
 * @param error Error that has occured
 * @param cb DoneCallback
 */
function reportError(job: Job<ArtworkProcessDTO>, error: Error, dc: DoneCallback) {
    const file = storageHelper.findArtworkFilepath(job.data.artwork);
    logger.error(`Failed processing artwork '${file}': ${error.message}`, error.stack);
    dc(error, null);
}