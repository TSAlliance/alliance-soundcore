import { forwardRef, Module } from '@nestjs/common';
import { AlbumService } from './album.service';
import { AlbumController } from './album.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlbumRepository } from './repositories/album.repository';

@Module({
  controllers: [AlbumController],
  providers: [AlbumService],
  imports: [
    TypeOrmModule.forFeature([ AlbumRepository ])
  ],
  exports: [
    AlbumService
  ]
})
export class AlbumModule {}
