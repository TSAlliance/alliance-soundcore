import { Module } from '@nestjs/common';
import { ArtworkController } from './artwork.controller';
import { SharedModule } from '../shared/shared.module';
import { StorageModule } from '../storage/storage.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworkRepository } from './repositories/artwork.repository';
import { IndexReportModule } from '../index-report/index-report.module';
import { ArtworkService as ArtworkServiceV2 } from './services/artwork.service';
import { ArtworkService } from './artwork.service';
import { ArtworkStorageHelper } from './helper/artwork-storage.helper';
import { BullModule } from '@nestjs/bull';
import { QUEUE_ARTWORKWRITE_NAME } from '../constants';
import path from 'path';

@Module({
  controllers: [ArtworkController],
  providers: [
    ArtworkServiceV2, 
    ArtworkStorageHelper,
    ArtworkService
  ],
  imports: [
    SharedModule,
    StorageModule,
    IndexReportModule,
    TypeOrmModule.forFeature([ ArtworkRepository ]),
    BullModule.registerQueue({
      name: QUEUE_ARTWORKWRITE_NAME,
      processors: [
        { path: path.join(__dirname, "worker", "artwork-write.worker.js"), concurrency: 4 }
      ],
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true
      }
    })
  ],
  exports: [
    ArtworkServiceV2,
    ArtworkService
  ]
})
export class ArtworkModule {}
