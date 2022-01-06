import { Module } from '@nestjs/common';
import { ArtworkModule } from '../artwork/artwork.module';
import { GeniusService } from './services/genius.service';

@Module({
  providers: [GeniusService],
  exports: [ GeniusService ],
  imports: [
    ArtworkModule
  ]
})
export class GeniusModule {}
