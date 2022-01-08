import { forwardRef, Module } from '@nestjs/common';
import { AlbumModule } from '../album/album.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { DistributorModule } from '../distributor/distributor.module';
import { GenreModule } from '../genre/genre.module';
import { LabelModule } from '../label/label.module';
import { PublisherModule } from '../publisher/publisher.module';
import { GeniusService } from './services/genius.service';

// TODO: Maybe implement song relations in the future?

@Module({
  providers: [GeniusService],
  exports: [ GeniusService ],
  imports: [
    ArtworkModule,
    PublisherModule,
    LabelModule,
    DistributorModule,
    GenreModule,
    forwardRef(() => AlbumModule)
  ]
})
export class GeniusModule {}
