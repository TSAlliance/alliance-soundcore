import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SongModule } from '../song/song.module';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
  imports: [
    SongModule
  ]
})
export class SearchModule {}
