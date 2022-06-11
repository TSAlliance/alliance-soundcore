import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenreController } from './controllers/genre.controller';
import { GenreRepository } from './repositories/genre.repository';
import { GenreService } from './services/genre.service';

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
