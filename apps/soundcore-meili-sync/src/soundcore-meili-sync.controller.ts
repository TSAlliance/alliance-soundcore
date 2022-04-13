import { Controller, Get } from '@nestjs/common';
import { SoundcoreMeiliSyncService } from './soundcore-meili-sync.service';

@Controller()
export class SoundcoreMeiliSyncController {
  constructor(private readonly soundcoreMeiliSyncService: SoundcoreMeiliSyncService) {}

  @Get()
  getHello(): string {
    return this.soundcoreMeiliSyncService.getHello();
  }
}
