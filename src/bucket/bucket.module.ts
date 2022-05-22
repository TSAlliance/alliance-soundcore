import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { BucketService } from './services/bucket.service';
import { BucketController } from './controllers/bucket.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BucketRepository } from './repositories/bucket.repository';
import os from "os"
import { RandomUtil } from '@tsalliance/rest';
import { StorageModule } from '../storage/storage.module';
import { IndexModule } from '../index/index.module';
import { BUCKET_ID } from '../shared/shared.module';
import { BullModule } from '@nestjs/bull';

@Module({
  controllers: [
    BucketController,
  ],
  providers: [
    BucketService, 
  ],
  exports: [ BucketService ],
  imports: [
    StorageModule,
    IndexModule,
    TypeOrmModule.forFeature([ BucketRepository ]),
    BullModule.registerQueue({
      name: "mount-queue"
    })
  ]
})
export class BucketModule implements OnModuleInit {
  private logger: Logger = new Logger(BucketModule.name);

  constructor(
    private bucketService: BucketService,
    @Inject(BUCKET_ID) private bucketId: string
  ){ }
  
  public async onModuleInit(): Promise<void> {
    await this.bucketService.createWithId(this.bucketId, {
      name: `${os.hostname()}#${RandomUtil.randomString(4)}`
    })

    /*await this.mountService.createWithId(this.mountId, {
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
    })*/
  }




}
