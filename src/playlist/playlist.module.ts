import { Module } from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { PlaylistController } from './playlist.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaylistRepository } from './repositories/playlist.repository';
import { SongModule } from '../song/song.module';

@Module({
  controllers: [PlaylistController],
  providers: [PlaylistService],
  imports: [
    SongModule,
    TypeOrmModule.forFeature([ PlaylistRepository ])
  ]
})
export class PlaylistModule {}
