import { Controller, Get, Param } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { AlbumService } from './album.service';

@Controller('albums')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  // TODO: Functionality to trigger album search on genius

  @Get("/byArtist/:artistId")
  public async findProfilesByArtist(@Param("artistId") artistId: string, @Pageable() pageable: Pageable) {
    return this.albumService.findProfilesByArtist(artistId, pageable);
  }

}
