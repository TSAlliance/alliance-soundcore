import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { BucketService } from './services/bucket.service';
import { BucketController } from './bucket.controller';
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
import { BUCKET_ID } from '../shared/shared.module';

@Module({
  controllers: [BucketController],
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
    @Inject(BUCKET_ID) private bucketId: string
  ){ }
  
  public async onModuleInit(): Promise<void> {
    await this.bucketService.createWithId(this.bucketId, {
      name: `${os.hostname()}#${RandomUtil.randomString(4)}`,
      isolated: false
    })

    await this.mountService.create({
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
