import { Module } from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { PlaylistController } from './playlist.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaylistRepository } from './repositories/playlist.repository';

@Module({
  controllers: [PlaylistController],
  providers: [PlaylistService],
  imports: [
    TypeOrmModule.forFeature([ PlaylistRepository ])
  ]
})
export class PlaylistModule {}
