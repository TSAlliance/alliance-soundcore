import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongController } from './song.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongRepository } from './repositories/song.repository';

@Module({
  controllers: [SongController],
  providers: [SongService],
  imports: [
    TypeOrmModule.forFeature([ SongRepository ])
  ],
  exports: [
    SongService
  ]
})
export class SongModule {}
