import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { BucketModule } from '../bucket/bucket.module';
import { StorageModule } from '../storage/storage.module';
import { IndexModule } from '../index/index.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { ImportGateway } from './gateway/import.gateway';

@Module({
  controllers: [ImportController],
  providers: [
    ImportService,
    ImportGateway
  ],
  imports: [
    BucketModule,
    StorageModule,
    IndexModule,
    ArtworkModule
  ]
})
export class ImportModule {}
