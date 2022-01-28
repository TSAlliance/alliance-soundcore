import { Module } from '@nestjs/common';
import { LikeService } from './like.service';
import { LikeController } from './like.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LikeRepository } from './repositories/like.repository';

@Module({
  controllers: [LikeController],
  providers: [LikeService],
  imports: [
    TypeOrmModule.forFeature([ LikeRepository ])
  ]
})
export class LikeModule {}
