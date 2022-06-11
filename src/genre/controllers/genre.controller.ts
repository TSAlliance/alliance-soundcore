import { Controller, Get, Param } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { GenreService } from '../services/genre.service';

@Controller('genres')
export class GenreController {
  constructor(private readonly service: GenreService) {}

  @Get("/byArtist/:artistId")
  public async findGenreByArtist(@Param("artistId") artistId: string, @Pageable() pageable: Pageable) {
    return this.service.findByArtist(artistId, pageable);
  }

  @Get(":genreId")
  public async findGenreById(@Param("genreId") genreId: string) {
    return this.service.findByIdOrSlug(genreId);
  }

  

}
