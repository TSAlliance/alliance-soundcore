import { Controller, Get, Param } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { GenreService } from './genre.service';

@Controller('genres')
export class GenreController {
  constructor(private readonly genreService: GenreService) {}

  @Get("/byArtist/:artistId")
  public async findGenreByArtist(@Param("artistId") artistId: string, @Pageable() pageable: Pageable) {
    return this.genreService.findGenreByArtist(artistId, pageable);
  }

  @Get(":genreId")
  public async findGenreById(@Param("genreId") genreId: string) {
    return this.genreService.findGenreById(genreId);
  }

  

}
