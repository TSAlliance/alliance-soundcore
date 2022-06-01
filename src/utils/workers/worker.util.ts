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

class DBWorkerImpl {
    private static _instance: DBWorkerImpl;
    private logger: Logger = new Logger("DBWorker");

    private readonly _connectionManager: ConnectionManager = getConnectionManager();

    /**
     * Check if an active database connection exists. If so, return it and otherwise
     * create a new connection.
     * @param name Connection name
     * @param options Database Connection Options
     * @returns Connection
     */
    public createOrGetConnection(name: string, options: DBWorkerOptions): Connection {
        const manager = this._connectionManager;

        if(manager.has(name)) {
            return manager.get(name);
        }
    
        this.logger.verbose(`No active database connection found for name '${name}'. Creating it...`);
        return manager.create({
            name: name,
            type: "mysql",
            port: options.port,
            host: options.host,
            database: options.database,
            username: options.username,
            password: options.password,
            entityPrefix: options.prefix,
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
    public establishConnection(name: string, options: DBWorkerOptions): Promise<Connection> {
        return new Promise((resolve) => {
            const connection = this.createOrGetConnection(name, options);
            if(connection.isConnected) {
                resolve(connection);
                return
            }
    
            resolve(connection.connect())
        })
    }


    public static getInstance(): DBWorkerImpl {
        if(typeof this._instance == "undefined" || this._instance == null) {
            this._instance = new DBWorkerImpl();
        }

        return this._instance;
    }
    
}

export const DBWorker = new DBWorkerImpl();