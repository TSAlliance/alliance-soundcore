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
import { UserModule } from '../user/user.module';
import { IndexModule } from '../index/index.module';
import { PlaylistModule } from '../playlist/playlist.module';

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
    AlbumModule,
    UserModule,
    IndexModule,
    PlaylistModule
  ]
})
export class SearchModule {}
