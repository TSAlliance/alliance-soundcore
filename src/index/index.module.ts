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

@Module({
  controllers: [
    IndexController
  ],
  providers: [
    IndexService, 
    IndexGateway, 
    QueueService
  ],
  imports: [
    SharedModule,
    StorageModule,
    SongModule,
    IndexReportModule,
    TypeOrmModule.forFeature([ IndexRepository ])
  ],
  exports: [
    IndexService
  ]
})
export class IndexModule implements OnModuleInit {

  constructor(private indexService: IndexService){}
  
  public async onModuleInit() {
    await this.indexService.clearOrResumeProcessing();
  }

}
