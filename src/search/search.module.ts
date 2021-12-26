import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { ArtistModule } from '../artist/artist.module';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
  imports: [
    ArtistModule
  ]
})
export class SearchModule {}
