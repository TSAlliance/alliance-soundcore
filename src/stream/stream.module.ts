import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { StorageModule } from '../storage/storage.module';
import { SongModule } from '../song/song.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamRepository } from './repositories/stream.repository';

@Module({
  controllers: [StreamController],
  providers: [StreamService],
  imports: [
    SongModule,
    StorageModule,

    TypeOrmModule.forFeature([ StreamRepository ])
  ]
})
export class StreamModule {}
