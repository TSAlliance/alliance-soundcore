import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { BucketService } from './services/bucket.service';
import { BucketController } from './controllers/bucket.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BucketRepository } from './repositories/bucket.repository';
import { MountRepository } from './repositories/mount.repository';
import os from "os"
import { RandomUtil } from '@tsalliance/rest';
import { MountService } from './services/mount.service';
import path from 'path';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';
import { IndexModule } from '../index/index.module';
import { BUCKET_ID, MOUNT_ID } from '../shared/shared.module';
import { MountController } from './controllers/mount.controller';

@Module({
  controllers: [
    BucketController,
    MountController
  ],
  providers: [
    BucketService, 
    MountService
  ],
  exports: [ BucketService, MountService ],
  imports: [
    StorageModule,
    IndexModule,
    TypeOrmModule.forFeature([ BucketRepository, MountRepository ])
  ]
})
export class BucketModule implements OnModuleInit {

  constructor(
    private bucketService: BucketService,
    private mountService: MountService,
    private storageService: StorageService,
    @Inject(BUCKET_ID) private bucketId: string,
    @Inject(MOUNT_ID) private mountId: string
  ){ }
  
  public async onModuleInit(): Promise<void> {
    await this.bucketService.createWithId(this.bucketId, {
      name: `${os.hostname()}#${RandomUtil.randomString(4)}`,
      isolated: false
    })

    await this.mountService.createWithId(this.mountId, {
      name: `Default Mount#${RandomUtil.randomString(4)}`,
      path: `${path.join(this.storageService.getSoundcoreDir(), this.bucketId)}`,
      bucket: { id: this.bucketId }
    }).catch(() => {
      // Do nothing
    }).then(() => {
      this.mountService.checkLocalIndices();
    })
  }




}
