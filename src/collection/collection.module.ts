import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionController } from './controller/collection.controller';
import { LikeController } from './controller/like.controller';
import { LikeRepository } from './repositories/like.repository';
import { CollectionService } from './services/collection.service';
import { LikeService } from './services/like.service';

@Module({
  controllers: [
    CollectionController,
    LikeController
  ],
  providers: [
    CollectionService,
    LikeService
  ],
  imports: [
    TypeOrmModule.forFeature([ LikeRepository ])
  ]
})
export class CollectionModule {}
