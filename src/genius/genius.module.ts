import { Module } from '@nestjs/common';
import { ArtworkModule } from '../artwork/artwork.module';
import { LabelModule } from '../label/label.module';
import { PublisherModule } from '../publisher/publisher.module';
import { GeniusService } from './services/genius.service';

@Module({
  providers: [GeniusService],
  exports: [ GeniusService ],
  imports: [
    ArtworkModule,
    PublisherModule,
    LabelModule
  ]
})
export class GeniusModule {}
