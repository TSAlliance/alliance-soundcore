import { Module } from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { PlaylistController } from './playlist.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaylistRepository } from './repositories/playlist.repository';
import { SongModule } from '../song/song.module';
import { Song2PlaylistRepository } from './repositories/song2playlist.repository';
import { ArtworkModule } from '../artwork/artwork.module';

@Module({
  controllers: [PlaylistController],
  providers: [PlaylistService],
  imports: [
    SongModule,
    ArtworkModule,
    TypeOrmModule.forFeature([ PlaylistRepository, Song2PlaylistRepository ])
  ],
  exports: [
    PlaylistService
  ]
})
export class PlaylistModule {}
