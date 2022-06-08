import path from 'path';
import { BullModule } from '@nestjs/bull';
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_MOUNTSCAN_NAME } from '../constants';
import { StorageModule } from '../storage/storage.module';
import { MountRepository } from './repositories/mount.repository';
import { MountService } from './services/mount.service'
import { MountController } from './controllers/mount.controller';
import { MountGateway } from './gateway/mount.gateway';

@Module({
  controllers: [
    MountController
  ],
  providers: [
    MountService,
    MountGateway
  ],
  imports: [
    StorageModule,
    TypeOrmModule.forFeature([ MountRepository ]),
    BullModule.registerQueue({
      name: QUEUE_MOUNTSCAN_NAME,
      processors: [
        { 
          path: path.join(__dirname, "worker", "mount.worker.js"), 
          concurrency: parseInt(process.env.MAX_SCANNERS) || 4 
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
