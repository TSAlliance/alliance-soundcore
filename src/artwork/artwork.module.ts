import { Module } from '@nestjs/common';
import { ArtworkController } from './artwork.controller';
import { SharedModule } from '../shared/shared.module';
import { StorageModule } from '../storage/storage.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworkRepository } from './repositories/artwork.repository';
import { ArtworkService } from './services/artwork.service';
import { ArtworkStorageHelper } from './helper/artwork-storage.helper';

@Module({
  controllers: [ArtworkController],
  providers: [
    ArtworkStorageHelper,
    ArtworkService
  ],
  imports: [
    SharedModule,
    StorageModule,
    TypeOrmModule.forFeature([ ArtworkRepository ])
  ],
  exports: [
    ArtworkService
  ]
})
export class ArtworkModule {}
