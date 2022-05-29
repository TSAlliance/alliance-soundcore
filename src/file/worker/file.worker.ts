import { Logger } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import pathfs from "path";
import { FileFlag } from "../enums/file-flag.enum";
import { File } from "../entities/file.entity";
import { FileProcessDTO } from "../dto/file-process.dto";
import { createConnection } from "typeorm";

const logger = new Logger("FileProcessor")

export default async function (job: Job<FileProcessDTO>, cb: DoneCallback) {    
    const options = job.data.dbOptions;
    console.log(options)

    // Create database connection
    const connection = await createConnection({
        type: "mysql",
        entities: [ File ],
        port: options.port,
        host: options.host,
        database: options.database,
        username: options.username,
        password: options.password,
        entityPrefix: options.prefix
    }).catch((error: Error) => {
        console.error(error)
        return null;
    });

    console.log("connected? ", connection?.isConnected);

    
    const file = job.data.file;
    const path = pathfs.join(file.mount.directory, file.directory || ".", file.filename);
    const startTime = Date.now();
    const flag = FileFlag.PROCESSING;

    logger.verbose(`Started processing file '${path}'`);
    //

    logger.verbose(`Processed file '${path}' in ${Date.now()-startTime}ms.`)
    cb(null, {});
}