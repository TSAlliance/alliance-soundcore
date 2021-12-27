import { Module } from '@nestjs/common';
import { PublisherService } from './publisher.service';
import { PublisherController } from './publisher.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublisherRepository } from './repositories/publisher.repository';

@Module({
  controllers: [PublisherController],
  providers: [PublisherService],
  imports: [
    TypeOrmModule.forFeature([ PublisherRepository ])
  ],
  exports: [
    PublisherService
  ]
})
export class PublisherModule {}
