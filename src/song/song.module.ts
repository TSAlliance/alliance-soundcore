import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongController } from './song.controller';
import { UploadModule } from '../upload/upload.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongRepository } from './repositories/song.repository';
import { ArtworkModule } from '../artwork/artwork.module';
import { ArtistModule } from '../artist/artist.module';

@Module({
  controllers: [SongController],
  providers: [SongService],
  exports: [ SongService ],
  imports: [
    ArtworkModule,
    ArtistModule,
    UploadModule,
    TypeOrmModule.forFeature([ SongRepository ])
  ]
})
export class SongModule {}
