import { DataSource } from "typeorm";
import { TYPEORM_ENTITY_GLOB } from "../../constants";

export class DBWorker {
    private static _instance: DBWorker;

    private readonly _datasource: DataSource = new DataSource({
        type: "mysql",
        port: parseInt(process.env.DB_PORT),
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASS,
        username: process.env.DB_USER,
        entityPrefix: process.env.DB_PREFIX || "sc_",
        entities: [
            TYPEORM_ENTITY_GLOB
        ]
    });

    /**
     * Get a connection to the database via typeorm.
     * If the datasource was initialized previously, then
     * this datasource is returned, otherwise it will be
     * initialized and returned afterwards
     * @returns DataSource
     */
    public async establishConnection(): Promise<DataSource> {
        if(this._datasource.isInitialized) return this._datasource;
        return this._datasource.initialize();
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