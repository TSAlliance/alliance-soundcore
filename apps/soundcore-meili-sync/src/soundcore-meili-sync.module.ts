import { Module } from '@nestjs/common';
import { SoundcoreMeiliSyncController } from './soundcore-meili-sync.controller';
import { SoundcoreMeiliSyncService } from './soundcore-meili-sync.service';

@Module({
  imports: [],
  controllers: [SoundcoreMeiliSyncController],
  providers: [SoundcoreMeiliSyncService],
})
export class SoundcoreMeiliSyncModule {}
