import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { Pageable } from 'nestjs-pager';
import { User } from '../user/entities/user.entity';
import { AlbumService } from './album.service';

@Controller('albums')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  // TODO: Functionality to trigger album search on genius

  @Get("/byArtist/:artistId")
  public async findProfilesByArtist(@Param("artistId") artistId: string, @Pageable() pageable: Pageable, @AuthenticatedUser() authentication: User) {
    return this.albumService.findProfilesByArtist(artistId, pageable, authentication);
  }

  @Get("/byArtist/:artistId/recommended")
  public async findRecommendedProfilesByArtist(@Param("artistId") artistId: string, @Query("except") exceptAlbumIds: string[], @AuthenticatedUser() authentication: User) {
    return this.albumService.findRecommendedProfilesByArtist(artistId, exceptAlbumIds, authentication);
  }

  @Get("/byFeaturedArtist/:artistId")
  public async findByFeaturedArtist(@Param("artistId") artistId: string, @Pageable() pageable: Pageable, @AuthenticatedUser() authentication: User) {
    return this.albumService.findFeaturedWithArtist(artistId, pageable, authentication);
  }

  @Get("/byGenre/:genreId")
  public async findByGenre(@Param("genreId") genreId: string, @Pageable() pageable: Pageable, @AuthenticatedUser() authentication: User) {
    return this.albumService.findByGenre(genreId, pageable, authentication);
  }

  @Get(":albumId")
  public async findProfileById(@Param("albumId") albumId: string, @AuthenticatedUser() authentication: User) {
    return this.albumService.findProfileById(albumId, authentication);
  }

}
