import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Page, Pageable } from "nestjs-pager";
import { AlbumService } from "../../album/album.service";
import { Album } from "../../album/entities/album.entity";
import { ArtistService } from "../../artist/artist.service";
import { Artist } from "../../artist/entities/artist.entity";
import { SyncFlag } from "../../meilisearch/interfaces/syncable.interface";

@Injectable()
export class MeiliSyncer {
    private readonly logger = new Logger(MeiliSyncer.name);

    private _isResolvingSyncErrors = false;

    constructor(
        private readonly artistService: ArtistService,
        private readonly albumService: AlbumService
    ) { }

    /**
     * Check if syncs have been marked as failed
     * in the database every 30 seconds.
     */
    @Cron('30 * * * * *')
    public async checkMeilisearchSyncFlags() {
        // Skip this iteration, if the application is still busy
        // with resolve the errors.
        if(this._isResolvingSyncErrors) return;

        // Otherwise mark as busy
        this._isResolvingSyncErrors = true;

        // Only check 50 entities at once. Because this has to be done for
        // more than one table, this could cause some performance issues when
        // doing larger requests. This is compensated of the frequency of the cron job.
        const affectedArtists = await this.artistService.findBySyncFlag(SyncFlag.ERROR, new Pageable(0, 50)).catch(() => Page.of([]));
        const affectedAlbums = await this.albumService.findBySyncFlag(SyncFlag.ERROR, new Pageable(0, 50)).catch(() => Page.of([]));
    
        // Resolve errors
        this.resolveSyncErrorsForArtists(affectedArtists.elements);
        this.resolveSyncErrorsForAlbums(affectedAlbums.elements);
    }

    private async resolveSyncErrorsForArtists(resources: Artist[]) {
        if(resources.length <= 0) return;
        return this.artistService.sync(resources).catch((error) => {
            this.logger.error(`Failed resolving sync issues for ${resources.length} artists`, error.stack);
        });
    }

    private async resolveSyncErrorsForAlbums(resources: Album[]) {
        if(resources.length <= 0) return;
        return this.albumService.sync(resources).catch((error) => {
            this.logger.error(`Failed resolving sync issues for ${resources.length} albums`, error.stack);
        });
    }
}