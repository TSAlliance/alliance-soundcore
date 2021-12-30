import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { StorageModule } from '../storage/storage.module';
import { SongModule } from '../song/song.module';

@Module({
  controllers: [StreamController],
  providers: [StreamService],
  imports: [
    SongModule,
    StorageModule
  ]
})
export class StreamModule {}
