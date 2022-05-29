import { Logger } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import pathfs from "path";
import { FileProcessDBOptions, FileProcessDTO } from "../dto/file-process.dto";
import { Connection, getConnectionManager } from "typeorm";
import { TYPEORM_CONNECTION_FILEWORKER } from "../../constants";
import { File } from "../entities/file.entity";

const logger = new Logger("FileProcessor")
const manager = getConnectionManager();

export default function (job: Job<FileProcessDTO>, cb: DoneCallback) {    
    const dbOptions = job.data.dbOptions;
    const startTime = Date.now();

    const file = job.data.file;
    const mount = job.data.file.mount;
    const path = pathfs.join(file.mount.directory, file.directory || ".", file.filename);

    logger.verbose(`Started processing file '${path}'`);

    establishConnection(dbOptions).then((connection) => {
        const repository = connection.getRepository(File)

        //const repository = connection.getRepository(File)
        //console.log(repository);

        // const entityManager = connection.createEntityManager();
        //entityManager.findOne(File, {  }).then((f) => console.log(f)).catch((error) => console.log(error));
        // console.log(entityManager.connection.name);

        logger.verbose(`Processed file '${path}' in ${Date.now()-startTime}ms.`)
    }).catch((error: Error) => {
        // Handle error
        reportError(job, error, cb);
    })
}

function establishConnection(dbOptions: FileProcessDBOptions): Promise<Connection> {
    return new Promise((resolve) => {
        const connection = getOrCreateConnection(dbOptions);
        if(connection.isConnected) {
            resolve(connection);
            return
        }

        resolve(connection.connect())
    })
}

/**
 * Check if an active database connection exists. If so, return it and otherwise
 * create a new connection.
 * @param dbOptions Database Connection Options
 * @returns Connection
 */
function getOrCreateConnection(dbOptions: FileProcessDBOptions): Connection {
    if(manager.has(TYPEORM_CONNECTION_FILEWORKER)) {
        return manager.get(TYPEORM_CONNECTION_FILEWORKER);
    }

    logger.debug(`No active database connection found for name '${TYPEORM_CONNECTION_FILEWORKER}'. Creating it...`);
    return manager.create({
        name: TYPEORM_CONNECTION_FILEWORKER,
        type: "mysql",
        port: dbOptions.port,
        host: dbOptions.host,
        database: dbOptions.database,
        username: dbOptions.username,
        password: dbOptions.password,
        entityPrefix: dbOptions.prefix,
        connectTimeout: 2000,
        entities: [ 
            pathfs.join(__dirname, "..", "entities", "*.{ts,js}")
        ]
    });
}

/**
 * Report the error to the log.
 * This will create log entries as well as execute the DoneCallback
 * passing in the error and null as the job's result.
 * @param job Job where the error occured
 * @param error Error that has occured
 * @param cb DoneCallback
 */
 function reportError(job: Job<FileProcessDTO>, error: Error, cb: DoneCallback) {
    const file = job.data.file
    const path = pathfs.join(file.mount.directory, file.directory, file.filename);

    logger.error(`Failed processing file '${path}': ${error.message}`);
    console.error(error);
    cb(error, null);
}