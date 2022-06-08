import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import path from 'path';
import { ArtworkModule } from '../artwork/artwork.module';
import { QUEUE_GENIUS_NAME } from '../constants';
import { DistributorModule } from '../distributor/distributor.module';
import { GenreModule } from '../genre/genre.module';
import { LabelModule } from '../label/label.module';
import { PublisherModule } from '../publisher/publisher.module';
import { GeniusClientService } from './services/genius-client.service';
import { GeniusService } from './services/genius.service';

@Module({
  providers: [GeniusService, GeniusClientService ],
  exports: [ GeniusService, GeniusClientService ],
  imports: [
    ArtworkModule,
    PublisherModule,
    LabelModule,
    DistributorModule,
    GenreModule,
    ArtworkModule,
    BullModule.registerQueue({
      name: QUEUE_GENIUS_NAME,
      processors: [
        { path: path.join(__dirname, "worker", "genius.worker.js"), concurrency: 1 }
      ],
      defaultJobOptions: {
        removeOnComplete: true,
        attempts: 10,
        delay: 5000
      }
    })
  ]
})
export class GeniusModule {}
