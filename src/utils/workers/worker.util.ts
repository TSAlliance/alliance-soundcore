/* eslint-disable @typescript-eslint/ban-types */
import { Logger } from "@nestjs/common";
import { Connection, ConnectionManager, getConnectionManager } from "typeorm";

export interface DBWorkerOptions {
    port: number
    host: string
    database: string
    username: string
    password: string
    prefix?: string
}

export class DBWorker {
    private static _instance: DBWorker;
    private logger: Logger = new Logger("DBWorker");

    private readonly workerOptions: DBWorkerOptions = {
        port: parseInt(process.env.DB_PORT),
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASS,
        username: process.env.DB_USER,
        prefix: process.env.DB_PREFIX
    }

    private readonly _connectionManager: ConnectionManager = getConnectionManager();

    constructor() {
        console.log("new dbworker instance");
    }

    /**
     * Check if an active database connection exists. If so, return it and otherwise
     * create a new connection.
     * @param name Connection name
     * @param options Database Connection Options
     * @returns Connection
     */
    public createOrGetConnection(name: string): Connection {
        const manager = this._connectionManager;

        if(manager.has(name)) {
            return manager.get(name);
        }
    
        this.logger.verbose(`No active database connection found for name '${name}'. Creating it...`);
        return manager.create({
            name: name,
            type: "mysql",
            port: this.workerOptions.port,
            host: this.workerOptions.host,
            database: this.workerOptions.database,
            username: this.workerOptions.username,
            password: this.workerOptions.password,
            entityPrefix: this.workerOptions.prefix,
            connectTimeout: 2000,
            entities: [ "dist/**/*.entity.js" ]
        });
    }

    /**
     * Extends the functionality of createOrGetConnection() by actually triggering the
     * connect() function.
     * @param name Connection name
     * @param options Database Connection Options
     * @returns Connection
     */
    public establishConnection(name: string): Promise<Connection> {
        return new Promise((resolve) => {
            const connection = this.createOrGetConnection(name);
            if(connection.isConnected) {
                resolve(connection);
                return
            }
    
            resolve(connection.connect())
        })
    }

    public static instance(): Promise<DBWorker> {
        return new Promise((resolve) => {
            if(!DBWorker._instance) {
                DBWorker._instance = new DBWorker();
            }
    
            resolve(DBWorker._instance);
        })
    }
}