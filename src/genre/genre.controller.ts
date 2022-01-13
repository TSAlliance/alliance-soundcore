import { Controller, Get, Param } from '@nestjs/common';
import { GenreService } from './genre.service';

@Controller('genres')
export class GenreController {
  constructor(private readonly genreService: GenreService) {}

  @Get(":genreId")
  public async findGenreById(@Param("genreId") genreId: string) {
    return this.genreService.findGenreById(genreId);
  }

}
