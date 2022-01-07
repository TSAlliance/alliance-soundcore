import { Module } from '@nestjs/common';
import { GenreService } from './genre.service';
import { GenreController } from './genre.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenreRepository } from './repositories/genre.repository';

@Module({
  controllers: [GenreController],
  providers: [GenreService],
  imports: [
    TypeOrmModule.forFeature([ GenreRepository ])
  ],
  exports: [
    GenreService
  ]
})
export class GenreModule {}
