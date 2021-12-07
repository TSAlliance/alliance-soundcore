import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { UploadModule } from '../upload/upload.module';
import { SongModule } from '../song/song.module';

@Module({
  controllers: [StreamController],
  providers: [StreamService],
  imports: [UploadModule, SongModule]
})
export class StreamModule {}
