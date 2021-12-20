import { forwardRef, Module } from '@nestjs/common';
import { UploadService } from './services/upload.service';
import { UploadController } from './upload.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadedFileRepository } from './repositories/uploaded-file.repository';
import { CleanUploadService } from './jobs/clean-upload.cron';
import { SongModule } from '../song/song.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UploadStatusGateway } from './gateways/upload-status.gateway';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ArtworkModule } from '../artwork/artwork.module';

@Module({
  controllers: [UploadController],
  providers: [
    UploadService, 
    CleanUploadService,
    UploadStatusGateway
  ],
  imports: [
    ArtworkModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ UploadedFileRepository ]),
    forwardRef(() => SongModule),
    EventEmitterModule.forRoot()
  ],
  exports: [
    UploadService
  ]
})
export class UploadModule {}
