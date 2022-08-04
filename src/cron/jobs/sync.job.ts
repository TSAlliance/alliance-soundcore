import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Page, Pageable } from "nestjs-pager";
import { ArtistService } from "../../artist/artist.service";
import { SyncFlag } from "../../meilisearch/interfaces/syncable.interface";

@Injectable()
export class MeiliSyncer {
    private readonly logger = new Logger(MeiliSyncer.name);

    private _isResolvingSyncErrors = false;

    constructor(
        private readonly artistService: ArtistService
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
    
        if(affectedArtists.size > 0) {
            await this.artistService.sync(affectedArtists.elements).catch((error) => this.logger.error(`Failed resolving sync issues for ${affectedArtists.size} artists`, error.stack))
        }
    }
}