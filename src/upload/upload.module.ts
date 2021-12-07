import { forwardRef, Module } from '@nestjs/common';
import { UploadService } from './services/upload.service';
import { UploadController } from './upload.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadedFileRepository } from './repositories/uploaded-file.repository';
import { CleanUploadService } from './jobs/clean-upload.cron';
import { SongModule } from '../song/song.module';
import { ScheduleModule } from '@nestjs/schedule';
import { StorageService } from './services/storage.service';

@Module({
  controllers: [UploadController],
  providers: [
    UploadService, 
    StorageService,
    CleanUploadService
  ],
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ UploadedFileRepository ]),
    forwardRef(() => SongModule)
  ],
  exports: [
    UploadService
  ]
})
export class UploadModule {}
