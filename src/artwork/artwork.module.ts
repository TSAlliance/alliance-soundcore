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
    TypeOrmModule.forFeature([ ArtworkRepository ])
  ],
  exports: [
    ArtworkServiceV2,
    ArtworkService
  ]
})
export class ArtworkModule {}
