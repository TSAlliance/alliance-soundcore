import { Module } from '@nestjs/common';
import { GeniusService } from './services/genius.service';

@Module({
  providers: [GeniusService],
  exports: [ GeniusService ]
})
export class GeniusModule {}
