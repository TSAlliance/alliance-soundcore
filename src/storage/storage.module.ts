import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BucketRepository } from './repositories/bucket.repository';
import { StorageBucketService } from './services/bucket.service';
import { MountRepository } from './repositories/mount.repository';
import { StorageMountService } from './services/mount.service';

@Module({
  controllers: [StorageController],
  providers: [
    StorageBucketService,
    StorageMountService
  ],
  imports: [
    TypeOrmModule.forFeature([ BucketRepository, MountRepository ])
  ]
})
export class StorageModule {}
