import { Module } from '@nestjs/common';
import { IndexService } from './index.service';
import { IndexController } from './index.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexRepository } from './repositories/index.repository';
import { StorageModule } from '../storage/storage.module';
import { SongModule } from '../song/song.module';

@Module({
  controllers: [IndexController],
  providers: [IndexService],
  imports: [
    StorageModule,
    SongModule,
    TypeOrmModule.forFeature([ IndexRepository ])
  ],
  exports: [
    IndexService
  ]
})
export class IndexModule {}
