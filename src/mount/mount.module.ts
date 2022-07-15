import path from 'path';
import { BullModule } from '@nestjs/bull';
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_MOUNTSCAN_NAME } from '../constants';
import { MountService } from './services/mount.service'
import { MountController } from './controllers/mount.controller';
import { MountGateway } from './gateway/mount.gateway';
import { Mount } from './entities/mount.entity';

@Module({
  controllers: [
    MountController
  ],
  providers: [
    MountService,
    MountGateway
  ],
  imports: [
    TypeOrmModule.forFeature([ Mount ]),
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
