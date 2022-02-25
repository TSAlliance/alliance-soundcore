import { Module, OnModuleInit } from '@nestjs/common';
import { IndexService } from './services/index.service';
import { IndexController } from './index.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexRepository } from './repositories/index.repository';
import { StorageModule } from '../storage/storage.module';
import { SongModule } from '../song/song.module';
import { SharedModule } from '../shared/shared.module';
import { IndexGateway } from './gateway/index.gateway';
import { QueueService } from './services/queue.service';
import { IndexReportModule } from '../index-report/index-report.module';
import { IndexConsumer } from './consumer/index.consumer';
import { BullModule } from '@nestjs/bull';

@Module({
  controllers: [
    IndexController
  ],
  providers: [
    IndexService, 
    IndexGateway, 
    QueueService,
    IndexConsumer
  ],
  imports: [
    SharedModule,
    StorageModule,
    SongModule,
    IndexReportModule,
    TypeOrmModule.forFeature([ IndexRepository ]),
    BullModule.registerQueue({
      name: "index",
      settings: {
        drainDelay: 3000
      },
      defaultJobOptions: {
        removeOnFail: true,
        removeOnComplete: true,
        timeout: 30000
      }
    }),
  ],
  exports: [
    IndexService
  ]
})
export class IndexModule {}
