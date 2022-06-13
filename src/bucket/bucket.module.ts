import os from "os"
import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { BucketService } from './services/bucket.service';
import { BucketController } from './controllers/bucket.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { BUCKET_ID } from '../shared/shared.module';
import { BullModule } from '@nestjs/bull';
import { Random } from '@tsalliance/utilities';
import { Bucket } from './entities/bucket.entity';

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
    TypeOrmModule.forFeature([ Bucket ]),
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
      name: `${os.hostname()}#${Random.randomString(4)}`
    });
  }




}
