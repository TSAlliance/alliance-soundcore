import { Module } from '@nestjs/common';
import { AlbumService } from './album.service';
import { AlbumController } from './album.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlbumRepository } from './repositories/album.repository';
import { ArtworkModule } from '../artwork/artwork.module';
import { GeniusModule } from '../genius/genius.module';

@Module({
  controllers: [AlbumController],
  providers: [AlbumService],
  imports: [
    ArtworkModule,
    GeniusModule,
    TypeOrmModule.forFeature([ AlbumRepository ])
  ],
  exports: [
    AlbumService
  ]
})
export class AlbumModule {}
