import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Pageable, Pagination } from 'nestjs-pager';
import { Authentication } from '../../authentication/decorators/authentication.decorator';
import { Roles } from '../../authentication/decorators/role.decorator';
import { ROLE_ADMIN, ROLE_MOD } from '../../constants';
import { User } from '../../user/entities/user.entity';
import { AlbumService } from '../album.service';
import { CreateAlbumDTO } from '../dto/create-album.dto';
import { UpdateAlbumDTO } from '../dto/update-album.dto';

@Controller('albums')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  @Get("/byArtist/:artistId")
  public async findProfilesByArtist(@Param("artistId") artistId: string, @Pagination() pageable: Pageable, @Authentication() authentication: User) {
    return this.albumService.findByArtist(artistId, pageable, authentication);
  }

  @Get("/byArtist/:artistId/recommended")
  public async findRecommendedProfilesByArtist(@Param("artistId") artistId: string, @Query("except") exceptAlbumIds: string[], @Authentication() authentication: User) {
    return this.albumService.findRecommendedProfilesByArtist(artistId, exceptAlbumIds, authentication);
  }

  @Get("/byFeaturedArtist/:artistId")
  public async findByFeaturedArtist(@Param("artistId") artistId: string, @Pagination() pageable: Pageable, @Authentication() authentication: User) {
    return this.albumService.findFeaturedWithArtist(artistId, pageable, authentication);
  }

  @Get("/byGenre/:genreId")
  public async findByGenre(@Param("genreId") genreId: string, @Pagination() pageable: Pageable, @Authentication() authentication: User) {
    return this.albumService.findByGenre(genreId, pageable, authentication);
  }

  @Get(":albumId")
  public async findProfileById(@Param("albumId") albumId: string, @Authentication() authentication: User) {
    return this.albumService.findById(albumId, authentication);
  }

  @Roles(ROLE_MOD, ROLE_ADMIN)
  @Post()
  public async createAlbum(@Body() createAlbumDto: CreateAlbumDTO) {
    return this.albumService.createIfNotExists(createAlbumDto);
  }

  @Roles(ROLE_MOD, ROLE_ADMIN)
  @Put(":albumId")
  public async updateAlbum(@Param("albumId") albumId: string, @Body() updateAlbumDto: UpdateAlbumDTO) {
    return this.albumService.update(albumId, updateAlbumDto);
  }

}
