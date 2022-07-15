import { InternalServerErrorException, Logger } from "@nestjs/common";
import MeiliSearch, { Index, MeiliSearchError, SearchParams, Task } from "meilisearch";
import { BehaviorSubject, filter, firstValueFrom, Observable } from "rxjs";
import { Syncable, SyncFlag } from "../interfaces/syncable.interface";

export enum MeiliServiceSyncInterval {
    HOURLY = 1,
    DAILY = HOURLY * 24,
    WEEKLY = DAILY * 7,
    MONTHLY = DAILY * 30,
    YEARLY = DAILY * 365
}

export interface MeiliServiceOptions {

    searchableAttributes?: string[];
    filterableAttributes?: string[];
    syncRecommendedInterval?: MeiliServiceSyncInterval;

}

export abstract class MeiliService<T = any> {
    private readonly _logger: Logger = new Logger(MeiliService.name + "-" + this._indexUid);
    private readonly _initializedSubject: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public readonly $initialized: Observable<boolean> = this._initializedSubject.asObservable();

    constructor(
        private readonly _meili: MeiliSearch,
        private readonly _indexUid: string,
        private readonly _options: MeiliServiceOptions
    ) {
        this._init();
    }

    /**
     * Sync a document or multiple documents with meilisearch
     * search engine.
     * @param {T} document Document(s) to sync. 
     * @param {number} timeOutMs (Optional) Timeout when waiting for task to finish
     * @returns {Task} Task
     */
    public async sync(document: T | T[], timeOutMs?: number): Promise<Task> {
        const docs = Array.isArray(document) ? document : [ document ];

        return this.index().then((index) => {
            return index.addDocuments(docs).then((enqueuedTask) => {
                return this.client().waitForTask(enqueuedTask.taskUid, { timeOutMs });
            }).catch((error: MeiliSearchError) => {
                this._logger.error(`Failed creating document: ${error.message}`, error.stack);
                throw new InternalServerErrorException(`Synchronisation failed: ${error.message}`);
            });
        });
    }

    /**
     * Delete a document from meilisearch.
     * @param {string} documentId Document id to delete.
     * @param {number} timeOutMs (Optional) Timeout when waiting for task to finish
     * @returns {Task} Task
     */
    protected async delete(documentId: string, timeOutMs?: number) {
        return this.index().then((index) => {
            return index.deleteDocument(documentId).then((task) => {
                return this.client().waitForTask(task.taskUid, { timeOutMs });
            }).catch((error: MeiliSearchError) => {
                this._logger.error(`Failed deleting document with id '${documentId}': ${error.message}`, error.stack);
                throw new InternalServerErrorException(`Synchronisation failed: ${error.message}`);
            });
        });
    }

    /**
     * Check if the system settings would recommend 
     * a new sync attempt with meilisearch.
     * This checks the last syncFlag and lastSyncedAt values of the object.
     * @param syncable Object to sync.
     * @returns True or False if the recommended next date is overdue or if the last sync flag evaluates to error
     */
    public isSyncRecommended(syncable: Syncable): boolean {
        if(typeof syncable === "undefined" || syncable == null) return false;

        const current = new Date().getTime();
        const lastSyncedAt = new Date(syncable.lastSyncedAt).getTime();
        const recommendedDate = lastSyncedAt + 1000*60*60 * (this._options.syncRecommendedInterval || MeiliServiceSyncInterval.DAILY);

        return syncable.lastSyncFlag == SyncFlag.ERROR || current >= recommendedDate;
    }

    /**
     * Execute search query.
     * @param {string} query Search query
     * @param {SearchParams} params Search parameters
     * @param {Partial<Request>} config Search config
     * @returns {SearchResponse<T>} SearchResponse<T>
     */
    protected async search(query: string, params?: SearchParams, config?: Partial<Request>) {
        return this.index().then((index) => {
            return index.search<T>(query, params, config).catch((error) => {
                this._logger.error(`Search failed for query '${query}': ${error.message}`, error.stack)
                throw new InternalServerErrorException(`Internal error occured whilst requesting search engine.`);
            });
        });
    }

    /**
     * Get current Meilisearch client.
     * @returns {MeiliSearch} Meilisearch Client Instance
     */
    protected client(): MeiliSearch {
        return this._meili;
    }

    /**
     * Get the currently used index of the service implementation.
     * @returns {Index<T>} Meilisearch index used by the service
     */
    protected async index(): Promise<Index<T>> {
        return firstValueFrom(this.$initialized.pipe(filter((initialized) => initialized === true))).then(() => {
            return this.client().index<T>(this._indexUid);
        });
    }

    /**
     * Execute initialization of the index in meilisearch instance.
     * This will configure the index with the provided options (e.g. searchableAttributes
     * or filterableAttributes).
     */
    private _init() {
        this.client().createIndex(this._indexUid, { primaryKey: "id" }).then((enqueuedTask) => {
            return this._meili.waitForTask(enqueuedTask.taskUid).then(async () => {
                return this._meili.waitForTasks([
                    (await this.client().index<T>(this._indexUid).updateFilterableAttributes(this._options.filterableAttributes || []))?.taskUid,
                    (await this.client().index<T>(this._indexUid).updateSearchableAttributes(this._options.searchableAttributes || ["*"]))?.taskUid
                ]);
            })
        }).catch((error: MeiliSearchError) => {
            this._logger.error(`Error occured while initializing Index on meilisearch: ${error.message}`, error.stack);
        }).finally(() => {
            console.log("done.");
            this._initializedSubject.next(true);
        });
    }

}