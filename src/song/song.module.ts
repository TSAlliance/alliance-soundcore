import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongController } from './song.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongRepository } from './repositories/song.repository';
import { ArtistModule } from '../artist/artist.module';
import { GeniusModule } from '../genius/genius.module';
import { PublisherModule } from '../publisher/publisher.module';
import { LabelModule } from '../label/label.module';

@Module({
  controllers: [SongController],
  providers: [SongService],
  imports: [
    GeniusModule,
    ArtistModule,
    PublisherModule,
    LabelModule,
    TypeOrmModule.forFeature([ SongRepository ])
  ],
  exports: [
    SongService
  ]
})
export class SongModule {}
