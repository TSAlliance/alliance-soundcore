import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { StorageModule } from '../storage/storage.module';
import { BucketModule } from '../bucket/bucket.module';

@Module({
  controllers: [UploadController],
  providers: [UploadService],
  imports: [
    StorageModule,
    BucketModule,
  ]
})
export class UploadModule {



}
