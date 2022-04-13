import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
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
import { MountGateway } from './gateway/mount-status.gateway';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Mount } from './entities/mount.entity';
import { MountConsumer } from './consumer/mount.consumer';

@Module({
  controllers: [
    BucketController,
    MountController
  ],
  providers: [
    BucketService, 
    MountService,
    MountGateway,
    MountConsumer
  ],
  exports: [ BucketService, MountService ],
  imports: [
    StorageModule,
    IndexModule,
    TypeOrmModule.forFeature([ BucketRepository, MountRepository ]),
    BullModule.registerQueue({
      name: "mount-queue"
    })
  ]
})
export class BucketModule implements OnModuleInit {
  private logger: Logger = new Logger(BucketModule.name);

  constructor(
    private bucketService: BucketService,
    private mountService: MountService,
    private storageService: StorageService,
    private mountConsumer: MountConsumer,

    @Inject(BUCKET_ID) private bucketId: string,
    @Inject(MOUNT_ID) private mountId: string,
    @InjectQueue("mount-queue") private mountQueue: Queue<Mount>
  ){ }
  
  public async onModuleInit(): Promise<void> {
    await this.bucketService.createWithId(this.bucketId, {
      name: `${os.hostname()}#${RandomUtil.randomString(4)}`
    })

    await this.mountService.createWithId(this.mountId, {
      name: `Default Mount#${RandomUtil.randomString(4)}`,
      path: `${path.join(this.storageService.getSoundcoreDir(), this.bucketId)}`,
      bucket: { id: this.bucketId }
    }).catch(() => {
      // Do nothing
    }).then(() => {
      this.mountService.findByBucketId(this.bucketId).then((mounts) => {
        this.logger.verbose(`Found ${mounts.length} Mount(s) connected with this bucket (Bucket-ID: ${this.bucketId}).`);
        
        this.mountConsumer.clearQueue().then(() => {
          this.mountQueue.addBulk(mounts.map((mount) => {
            return { data: mount, opts: { jobId: mount.id }}
          }))
        })
      })
    })
  }




}
