import { Module } from '@nestjs/common';
import { ArtworkService } from './artwork.service';
import { ArtworkController } from './artwork.controller';
import { SharedModule } from '../shared/shared.module';

@Module({
  controllers: [ArtworkController],
  providers: [ArtworkService],
  imports: [
    SharedModule
  ],
  exports: [
    ArtworkService
  ]
})
export class ArtworkModule {}
