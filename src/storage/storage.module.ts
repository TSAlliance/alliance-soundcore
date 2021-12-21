import { Module } from '@nestjs/common';
import { BucketRepository } from './repositories/bucket.repository';
import { StorageBucketService } from './services/bucket.service';
import { MountRepository } from './repositories/mount.repository';
import { StorageMountService } from './services/mount.service';
import { StorageBucketController } from './controllers/bucket.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageMountController } from './controllers/mount.controller';
import { StorageService } from './services/storage.service';

@Module({
  controllers: [
    StorageBucketController,
    StorageMountController
  ],
  providers: [
    StorageBucketService,
    StorageMountService,
    StorageService
  ],
  imports: [
    TypeOrmModule.forFeature([ BucketRepository, MountRepository ])
  ]
})
export class StorageModule {}
