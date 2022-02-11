import { Module } from '@nestjs/common';
import { ArtworkService } from './artwork.service';
import { ArtworkController } from './artwork.controller';
import { SharedModule } from '../shared/shared.module';
import { StorageModule } from '../storage/storage.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworkRepository } from './repositories/artwork.repository';
import { IndexReportModule } from '../index-report/index-report.module';

@Module({
  controllers: [ArtworkController],
  providers: [ArtworkService],
  imports: [
    SharedModule,
    StorageModule,
    IndexReportModule,
    TypeOrmModule.forFeature([ ArtworkRepository ])
  ],
  exports: [
    ArtworkService
  ]
})
export class ArtworkModule {}
