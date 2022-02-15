import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongController } from './song.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongRepository } from './repositories/song.repository';
import { ArtistModule } from '../artist/artist.module';
import { GeniusModule } from '../genius/genius.module';
import { PublisherModule } from '../publisher/publisher.module';
import { LabelModule } from '../label/label.module';
import { AlbumModule } from '../album/album.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { StorageModule } from '../storage/storage.module';
import { IndexReportModule } from '../index-report/index-report.module';

@Module({
  controllers: [SongController],
  providers: [SongService],
  imports: [
    GeniusModule,
    ArtistModule,
    PublisherModule,
    LabelModule,
    AlbumModule,
    ArtworkModule,
    StorageModule,
    IndexReportModule,
    TypeOrmModule.forFeature([ SongRepository ])
  ],
  exports: [
    SongService
  ]
})
export class SongModule {}
