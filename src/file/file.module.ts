import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import path from 'path';
import { QUEUE_FILE_NAME } from '../constants';
import { FileRepository } from './repositories/file.repository';
import { FileService } from './services/file.service';

@Module({
  providers: [
    FileService
  ],
  imports: [
    TypeOrmModule.forFeature([ FileRepository ]),
    BullModule.registerQueue({
      name: QUEUE_FILE_NAME,
      processors: [
        { path: path.join(__dirname, "worker", "file.worker.js"), concurrency: 1 }
      ],
      defaultJobOptions: {
        removeOnComplete: true
      }
    })
  ],
  exports: [
    FileService
  ]
})
export class FileModule {}
