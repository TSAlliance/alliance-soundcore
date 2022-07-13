import { Injectable } from "@nestjs/common";
import MeiliSearch, { SearchResponse, Task } from "meilisearch";
import { Pageable } from "nestjs-pager";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { PlaylistPrivacy } from "../../playlist/enums/playlist-privacy.enum";
import { User } from "../../user/entities/user.entity";
import { MeiliArtwork } from "../entities/meili-artwork.entity";
import { MeiliPlaylist } from "../entities/meili-playlist.entity";
import { MEILI_INDEX_PLAYLIST } from "../meilisearch.constants";

@Injectable()
export class MeiliPlaylistService {

    constructor(
        private readonly meili: MeiliSearch
    ) {
        this.index().updateSearchableAttributes(["name", "slug"])
        this.index().updateFilterableAttributes(["privacy", "author.id"])
    }

    /**
     * Add or update playlist document in meilisearch instance.
     * @param playlist Playlist data
     * @param timeOutMs Timeout for checking task completion
     * @returns Task
     */
    public async setPlaylist(playlist: Playlist, timeOutMs?: number): Promise<Task> {
        return this.meili.index<MeiliPlaylist>(MEILI_INDEX_PLAYLIST).addDocuments([
            {
                id: playlist.id,
                name: playlist.name,
                slug: playlist.slug,
                resourceType: playlist.resourceType,
                createdAt: playlist.createdAt,
                description: playlist.description,
                artwork: playlist.artwork ? new MeiliArtwork(playlist.artwork?.id, playlist.artwork?.colors) : null,
                privacy: playlist.privacy,
                flag: playlist.flag,
                author: {
                    id: playlist.author.id,
                    name: playlist.author.name,
                    slug: playlist.author.slug,
                    accentColor: playlist.author.accentColor,
                    resourceType: playlist.author.resourceType,
                    artwork: playlist.author.artwork ? new MeiliArtwork(playlist.author.artwork?.id, playlist.author.artwork?.colors) : null
                }
            }
        ]).then((task) => {
            return this.meili.waitForTask(task.taskUid, { timeOutMs });
        })
    }

    /**
     * Delete a playlist document from meilisearch.
     * @param playlistId Playlist's id
     * @param timeOutMs Timeout for checking task completion
     * @returns Task
     */
    public async deletePlaylist(playlistId: string, timeOutMs?: number): Promise<Task> {
        return this.index().deleteDocument(playlistId).then((task) => {
            return this.meili.waitForTask(task.taskUid, { timeOutMs });
        })
    }

    /**
     * Search for playlist ids.
     * @param {string} query Search query
     * @param {Pageable} pageable Page settings
     * @param {User} authentication 
     * @returns {SearchResponse} SearchResponse<MeiliPlaylist>
     */
    public async searchPlaylists(query: string, pageable: Pageable, authentication: User): Promise<SearchResponse<MeiliPlaylist>> {
        return this.index().search(query, {
            attributesToRetrieve: ["*"],
            limit: pageable.size,
            offset: pageable.size * pageable.page,
            showMatchesPosition: true,
            filter: `privacy = '${PlaylistPrivacy.PUBLIC}' OR author.id = '${authentication.id}'`
        })
    }

    /**
     * Get index to use in this service.
     * @returns Index<MeiliPlaylist>
     */
    protected index() {
        const index = this.meili.index<MeiliPlaylist>(MEILI_INDEX_PLAYLIST);
        return index;
    }

}