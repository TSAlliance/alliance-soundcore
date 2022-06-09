import { Module } from '@nestjs/common';
import { PublisherController } from './controllers/publisher.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublisherRepository } from './repositories/publisher.repository';
import { ArtworkModule } from '../artwork/artwork.module';
import { PublisherService } from './services/publisher.service';

@Module({
  controllers: [PublisherController],
  providers: [PublisherService],
  imports: [
    ArtworkModule,
    TypeOrmModule.forFeature([ PublisherRepository ])
  ],
  exports: [
    PublisherService
  ]
})
export class PublisherModule {}
