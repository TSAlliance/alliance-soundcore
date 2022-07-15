import { InternalServerErrorException } from "@nestjs/common";
import MeiliSearch, { Index, SearchParams, Task } from "meilisearch";
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

        return this.index().addDocuments(docs).then((enqueuedTask) => {
            return this.client().waitForTask(enqueuedTask.taskUid, { timeOutMs });
        }).catch(() => {
            throw new InternalServerErrorException("Could not sync element with search engine.");
        })
    }

    /**
     * Delete a document from meilisearch.
     * @param {string} documentId Document id to delete.
     * @param {number} timeOutMs (Optional) Timeout when waiting for task to finish
     * @returns {Task} Task
     */
    public async delete(documentId: string, timeOutMs?: number) {
        return this.index().deleteDocument(documentId).then((task) => {
            return this.client().waitForTask(task.taskUid, { timeOutMs });
        })
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
    public async search(query: string, params?: SearchParams, config?: Partial<Request>) {
        return this.index().search<T>(query, params, config)
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
    protected index(): Index<T> {
        return this.client().index<T>(this._indexUid);
    }

    private _init() {
        this.index().updateSearchableAttributes(this._options.searchableAttributes || ["*"]);
        this.index().updateFilterableAttributes(this._options.filterableAttributes || []);
    }

}