import { Module } from '@nestjs/common';
import { ArtistService } from './artist.service';
import { ArtistController } from './artist.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistRepository } from './repositories/artist.repository';
import { GeniusModule } from '../genius/genius.module';
import { IndexReportModule } from '../index-report/index-report.module';

@Module({
  controllers: [ArtistController],
  providers: [ArtistService],
  imports: [
    GeniusModule,
    IndexReportModule,
    TypeOrmModule.forFeature([ ArtistRepository ])
  ],
  exports: [
    ArtistService
  ]
})
export class ArtistModule {}
