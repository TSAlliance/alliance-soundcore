import { Module } from '@nestjs/common';
import { ArtistService } from './artist.service';
import { ArtistController } from './artist.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistRepository } from './repositories/artist.repository';

@Module({
  controllers: [ArtistController],
  providers: [ArtistService],
  imports: [
    TypeOrmModule.forFeature([ ArtistRepository ])
  ],
  exports: [
    ArtistService
  ]
})
export class ArtistModule {}
