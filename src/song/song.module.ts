import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongController } from './song.controller';
import { UploadModule } from '../upload/upload.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongRepository } from './repositories/song.repository';

@Module({
  controllers: [SongController],
  providers: [SongService],
  exports: [ SongService ],
  imports: [
    UploadModule,
    TypeOrmModule.forFeature([ SongRepository ])
  ]
})
export class SongModule {}
