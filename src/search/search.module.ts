import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SongModule } from '../song/song.module';
import { ArtistModule } from '../artist/artist.module';
import { GenreModule } from '../genre/genre.module';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
  imports: [
    SongModule,
    ArtistModule,
    GenreModule
  ]
})
export class SearchModule {}
