import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SongModule } from '../song/song.module';
import { ArtistModule } from '../artist/artist.module';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
  imports: [
    SongModule,
    ArtistModule
  ]
})
export class SearchModule {}
