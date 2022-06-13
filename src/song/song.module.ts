import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongController } from './controllers/song.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistModule } from '../artist/artist.module';
import { GeniusModule } from '../genius/genius.module';
import { PublisherModule } from '../publisher/publisher.module';
import { LabelModule } from '../label/label.module';
import { AlbumModule } from '../album/album.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { StorageModule } from '../storage/storage.module';
import { TracklistController } from './controllers/tracklist.controller';
import { TracklistService } from './services/tracklist.service';
import { Song } from './entities/song.entity';

@Module({
  controllers: [SongController, TracklistController],
  providers: [SongService, TracklistService],
  imports: [
    GeniusModule,
    ArtistModule,
    PublisherModule,
    LabelModule,
    AlbumModule,
    ArtworkModule,
    StorageModule,
    TypeOrmModule.forFeature([ Song ])
  ],
  exports: [
    SongService
  ]
})
export class SongModule {}
