import path from 'path';
import { BullModule } from '@nestjs/bull';
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_MOUNTSCAN_NAME } from '../constants';
import { StorageModule } from '../storage/storage.module';
import { MountRepository } from './repositories/mount.repository';
import { MountService } from './services/mount.service'
import { MountController } from './controllers/mount.controller';
import { IndexModule } from '../index/index.module';

@Module({
  controllers: [
    MountController
  ],
  providers: [
    MountService
  ],
  imports: [
    StorageModule,
    IndexModule,
    TypeOrmModule.forFeature([ MountRepository ]),
    BullModule.registerQueue({
      name: QUEUE_MOUNTSCAN_NAME,
      processors: [
        { 
          path: path.join(__dirname, "worker", "scan.worker.js"), 
          concurrency: parseInt(process.env.MAX_SCANNERS) || 3 
        }
      ],
      defaultJobOptions: {
        removeOnFail: true,
        removeOnComplete: true
      }
    })
  ],
  exports: [
    MountService
  ]
})
export class MountModule implements OnModuleInit {

  constructor(
    private readonly service: MountService
  ) {}

  public async onModuleInit() {
    this.service.checkForDefaultMount().finally(() => {
      this.service.checkMounts();
    })
  }

  

}
