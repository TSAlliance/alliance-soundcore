import { Inject, Injectable, Logger } from '@nestjs/common';
import MeiliSearch, { EnqueuedTask, Task } from 'meilisearch';
import { SoundcoreMeiliConfig } from '../config/meili.config';
import { SC_MEILI_OPTIONS } from '../constants';
import { MeiliAlbum } from '../entities/meili-album';
import { MeiliArtist } from '../entities/meili-artist';
import { MeiliSong } from '../entities/meili-song';
import { MeiliUser } from '../entities/meili-user';
import { ALBUMS_INDEX, ARTISTS_INDEX, SONGS_INDEX, USERS_INDEX } from '../registry/registry';

@Injectable()
export class SoundcoreMeiliService {
    private readonly logger: Logger = new Logger(SoundcoreMeiliService.name);
    private readonly _client: MeiliSearch;

    constructor(
        @Inject(SC_MEILI_OPTIONS) private readonly options: SoundcoreMeiliConfig
    ) {
        this._client = new MeiliSearch({
            host: `${this.options.host || '127.0.0.1'}:${this.options.port || 7700}`,
            apiKey: this.options.key
        })

        if(!this.options.indexes) this.options.indexes = [];
        this.options.indexes.push({ name: USERS_INDEX, primaryKey: "id", searchAttrs: MeiliUser.attrs() })
        this.options.indexes.push({ name: ALBUMS_INDEX, primaryKey: "id", searchAttrs: MeiliAlbum.attrs() })
        this.options.indexes.push({ name: ARTISTS_INDEX, primaryKey: "id", searchAttrs: MeiliArtist.attrs() })
        this.options.indexes.push({ name: SONGS_INDEX, primaryKey: "id", searchAttrs: MeiliSong.attrs() })

        for(const entry of this.options.indexes || []) {
            this._client.createIndex(entry.name, { primaryKey: entry.primaryKey }).then((equeuedTask: EnqueuedTask) => {
                this._client.waitForTask(equeuedTask.uid).then((task: Task) => {
                    this._client.index(entry.name).updateSearchableAttributes(entry.searchAttrs);
                    this.logger.verbose(`Setup of index '${entry.name}' done in ${task.duration}ms.`)
                }).catch((error: Error) => {
                    this.logger.error(`Error occured on index setup (waiting for task failed): ${error.message}`, error.stack);
                })
            }).catch((error: Error) => {
                this.logger.error(`Could not create index '${entry.name}': ${error.message}`, error.stack);
            })
        }
    }

    public client(): MeiliSearch {
        return this._client;
    }

    public userIndex() {
        return this._client.index<MeiliUser>(USERS_INDEX)
    }

    public songIndex() {
        return this._client.index<MeiliSong>(SONGS_INDEX)
    }

    public artistIndex() {
        return this._client.index<MeiliArtist>(ARTISTS_INDEX)
    }

    public albumIndex() {
        return this._client.index<MeiliAlbum>(ALBUMS_INDEX)
    }

}
