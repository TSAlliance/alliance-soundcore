import { Module } from '@nestjs/common';
import { ArtworkService } from './artwork.service';
import { ArtworkController } from './artwork.controller';
import { SharedModule } from '../shared/shared.module';
import { StorageModule } from '../storage/storage.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworkRepository } from './repositories/artwork.repository';

@Module({
  controllers: [ArtworkController],
  providers: [ArtworkService],
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
