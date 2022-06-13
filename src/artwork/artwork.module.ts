import { Module } from '@nestjs/common';
import { ArtworkController } from './artwork.controller';
import { SharedModule } from '../shared/shared.module';
import { StorageModule } from '../storage/storage.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworkService } from './services/artwork.service';
import { ArtworkStorageHelper } from './helper/artwork-storage.helper';
import { Artwork } from './entities/artwork.entity';

@Module({
  controllers: [ArtworkController],
  providers: [
    ArtworkStorageHelper,
    ArtworkService
  ],
  imports: [
    SharedModule,
    StorageModule,
    TypeOrmModule.forFeature([ Artwork ])
  ],
  exports: [
    ArtworkService
  ]
})
export class ArtworkModule {}
