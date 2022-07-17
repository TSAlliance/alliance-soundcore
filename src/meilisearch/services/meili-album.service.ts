import { Injectable } from "@nestjs/common";
import MeiliSearch, { SearchResponse, Task } from "meilisearch";
import { Pageable } from "nestjs-pager";
import { Album } from "../../album/entities/album.entity";
import { MeiliAlbum } from "../entities/meili-album.entity";
import { MeiliArtwork } from "../entities/meili-artwork.entity";
import { MEILI_INDEX_ALBUM } from "../meilisearch.constants";
import { MeiliService } from "./meili.service";

@Injectable()
export class MeiliAlbumService extends MeiliService<MeiliAlbum> {

    constructor(client: MeiliSearch) {
        super(client, MEILI_INDEX_ALBUM, {
            searchableAttributes: ["name"]
        })
    }

    /**
     * Add or update album document in meilisearch instance.
     * @param {Album} album Album data
     * @param {number} timeOutMs (Optional) Timeout for checking task completion
     * @returns {Task} Task
     */
    public async setAlbum(album: Album, timeOutMs?: number): Promise<Task> {
        return this.sync({
            id: album.id,
            name: album.name,
            slug: album.slug,
            resourceType: album.resourceType,
            createdAt: album.createdAt,
            releasedAt: album.releasedAt,
            artwork: album.artwork ? new MeiliArtwork(album.artwork?.id) : null,
            primaryArtist: {
                id: album.primaryArtist.id,
                name: album.primaryArtist.name,
                artwork: album.primaryArtist.artwork ? new MeiliArtwork(album.primaryArtist.artwork?.id) : null,
                resourceType: album.primaryArtist.resourceType,
                slug: album.primaryArtist.slug
            }
        }, timeOutMs);
    }

    /**
     * Delete an album document from meilisearch.
     * @param {string} albumId Album's id
     * @param {number} timeOutMs (Optional) Timeout for checking task completion
     * @returns {Task} Task
     */
    public async deleteAlbum(albumId: string, timeOutMs?: number): Promise<Task> {
        return this.delete(albumId, timeOutMs);
    }

    /**
     * Search for albums.
     * @param {string} query Search query
     * @param {Pageable} pageable Page settings
     * @returns {SearchResponse} SearchResponse<MeiliAlbum>
     */
    public async searchAlbum(query: string, pageable: Pageable): Promise<SearchResponse<MeiliAlbum>> {
        return this.search(query, {
            attributesToRetrieve: ["*"],
            limit: pageable.size,
            offset: pageable.size * pageable.page,
            showMatchesPosition: true,
        })
    }

}