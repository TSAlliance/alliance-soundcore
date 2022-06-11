import { forwardRef, Module } from '@nestjs/common';
import { AlbumService } from './album.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlbumRepository } from './repositories/album.repository';
import { GeniusModule } from '../genius/genius.module';
import { AlbumController } from './controllers/album.controller';

@Module({
  controllers: [AlbumController],
  providers: [AlbumService],
  imports: [
    forwardRef(() => GeniusModule),
    TypeOrmModule.forFeature([ AlbumRepository ])
  ],
  exports: [
    AlbumService
  ]
})
export class AlbumModule {}
