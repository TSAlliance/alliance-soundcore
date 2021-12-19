import { Module } from '@nestjs/common';
import { ArtworkService } from './artwork.service';
import { ArtworkController } from './artwork.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworkRepository } from './repositories/artwork.repository';
import { StorageModule } from '../storage/storage.module';
import { CleanArtworkService } from './jobs/clean-artwork.cron';

@Module({
  controllers: [ArtworkController],
  providers: [
    ArtworkService,
    CleanArtworkService
  ],
  imports: [
    StorageModule,
    TypeOrmModule.forFeature([ ArtworkRepository ])
  ],
  exports: [ ArtworkService ]
})
export class ArtworkModule {}
