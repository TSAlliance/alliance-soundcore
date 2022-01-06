import { Module } from '@nestjs/common';
import { DistributorService } from './distributor.service';
import { DistributorController } from './distributor.controller';
import { ArtworkModule } from '../artwork/artwork.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributorRepository } from './repositories/distributor.repository';

@Module({
  controllers: [DistributorController],
  providers: [DistributorService],
  exports: [
    DistributorService
  ],
  imports: [
    ArtworkModule,
    TypeOrmModule.forFeature([ DistributorRepository ])
  ]
})
export class DistributorModule {}
