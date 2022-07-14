import { InternalServerErrorException } from "@nestjs/common";
import MeiliSearch, { Index, Task } from "meilisearch";

export interface MeiliServiceOptions {

    searchableAttributes?: string[];
    filterableAttributes?: string[];

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

    public async search() {
        // TODO
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