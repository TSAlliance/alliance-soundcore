import { Module } from '@nestjs/common';
import { DistributorController } from './controllers/distributor.controller';
import { ArtworkModule } from '../artwork/artwork.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributorRepository } from './repositories/distributor.repository';
import { DistributorService } from './services/distributor.service';

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
