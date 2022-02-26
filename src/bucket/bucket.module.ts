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
import { Index } from '../index/entities/index.entity';
import { IndexService } from '../index/services/index.service';

@Module({
  controllers: [
    BucketController,
    MountController
  ],
  providers: [
    BucketService, 
    MountService,
    MountGateway
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
    private indexService: IndexService,
    @Inject(BUCKET_ID) private bucketId: string,
    @Inject(MOUNT_ID) private mountId: string,
    @InjectQueue("index") private indexQueue: Queue<Index>
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
        this.logger.verbose(`Found ${mounts.length} Mount(s) on this bucket.`);

        this.indexQueue.clean(0, "completed")
          .then(() => this.indexQueue.clean(0, "active"))
          .then(() => this.indexQueue.clean(0, "delayed"))
          .then(() => this.indexQueue.clean(0, "failed"))
          .then(() => this.indexQueue.clean(0, "paused"))
          .then(() => {
            this.logger.verbose(`Cleaned all jobs from queue, that were not active or waiting.`)

            this.indexQueue.getJobCountByTypes(["waiting"]).then((jobCount) => {
              const count: number = Object.values(jobCount).reduce((count, current) => count += current, 0);
              if(count > 0) {
                this.logger.verbose(`Found ${count} active/waiting jobs in queue.`);
                // TODO:
              }

              this.mountService.checkLocalIndices();
    
              // this.mountService.checkIndicesOfMount()
            })
          })
        
      })
      // this.mountService.checkLocalIndices();
    })
  }




}
