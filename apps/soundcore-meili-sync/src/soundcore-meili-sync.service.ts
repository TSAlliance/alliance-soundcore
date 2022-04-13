import { Injectable } from '@nestjs/common';

@Injectable()
export class SoundcoreMeiliSyncService {
  getHello(): string {
    return 'Hello World!';
  }
}
