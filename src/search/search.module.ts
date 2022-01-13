import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SongModule } from '../song/song.module';
import { ArtistModule } from '../artist/artist.module';
import { GenreModule } from '../genre/genre.module';
import { PublisherModule } from '../publisher/publisher.module';
import { LabelModule } from '../label/label.module';
import { DistributorModule } from '../distributor/distributor.module';
import { AlbumModule } from '../album/album.module';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
  imports: [
    SongModule,
    ArtistModule,
    GenreModule,
    PublisherModule,
    LabelModule,
    DistributorModule,
    AlbumModule
  ]
})
export class SearchModule {}
