import { Module } from '@nestjs/common';
import { IndexService } from './services/index.service';
import { IndexController } from './index.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexRepository } from './repositories/index.repository';
import { StorageModule } from '../storage/storage.module';
import { SongModule } from '../song/song.module';
import { SharedModule } from '../shared/shared.module';
import { IndexGateway } from './gateway/index.gateway';
import { IndexReportModule } from '../index-report/index-report.module';
import { BullModule } from '@nestjs/bull';
import { QUEUE_INDEX_NAME } from '../constants';

@Module({
  controllers: [
    IndexController
  ],
  providers: [
    IndexService, 
    IndexGateway, 
  ],
  imports: [
    SharedModule,
    StorageModule,
    SongModule,
    IndexReportModule,
    TypeOrmModule.forFeature([ IndexRepository ]),
    BullModule.registerQueue({
      name: QUEUE_INDEX_NAME,
      defaultJobOptions: {
        removeOnFail: true,
        removeOnComplete: true
      }
    }),
  ],
  exports: [
    IndexService
  ]
})
export class IndexModule {}
