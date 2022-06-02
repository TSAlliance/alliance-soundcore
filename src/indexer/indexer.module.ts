import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import path from 'path';
import { AlbumModule } from '../album/album.module';
import { ArtistModule } from '../artist/artist.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { QUEUE_INDEXER_NAME } from '../constants';
import { SongModule } from '../song/song.module';
import { IndexerService } from './services/indexer.service';

@Module({
    providers: [
        IndexerService
    ],
    imports: [
        SongModule,
        ArtistModule,
        AlbumModule,
        ArtworkModule,
        BullModule.registerQueue({
            name: QUEUE_INDEXER_NAME,
            processors: [
                { path: path.join(__dirname, "worker", "indexer.worker.js"), concurrency: parseInt(process.env.MAX_FILE_WORKERS) || 4 }
            ],
            defaultJobOptions: {
                removeOnComplete: true,
                removeOnFail: true
            }
        })
    ],
    exports: [
        IndexerService
    ]
})
export class IndexerModule {}
