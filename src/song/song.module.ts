import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongController } from './song.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongRepository } from './repositories/song.repository';
import { ArtistModule } from '../artist/artist.module';

@Module({
  controllers: [SongController],
  providers: [SongService],
  imports: [
    ArtistModule,
    TypeOrmModule.forFeature([ SongRepository ])
  ],
  exports: [
    SongService
  ]
})
export class SongModule {}
