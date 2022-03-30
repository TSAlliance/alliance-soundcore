import { Controller, Get, Param } from '@nestjs/common';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { Page, Pageable } from 'nestjs-pager';
import { User } from '../user/entities/user.entity';
import { Song } from './entities/song.entity';
import { SongService } from './song.service';

@Controller('songs')
export class SongController {
  constructor(private readonly songService: SongService) {}

  @Get("latest")
  public async findLatest(@AuthenticatedUser() user: User): Promise<Page<Song>> {
    return this.songService.findLatestPage(user);
  }

  @Get("oldest")
  public async findOldestRelease(@AuthenticatedUser() user: User): Promise<Page<Song>> {
    return this.songService.findOldestReleasePage(user);
  }

  @Get("/byCollection")
  public async findByCollection(@AuthenticatedUser() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByCollectionAndOrArtist(user, pageable)
  }

  @Get("/byCollection/ids")
  public async findIdsByCollection(@AuthenticatedUser() user: User): Promise<Page<Song>> {
    return this.songService.findIdsByCollection(user)
  }

  @Get("/byCollection/byArtist/:artistId")
  public async findByCollectionAndArtist(@Param("artistId") artistId: string, @AuthenticatedUser() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByCollectionAndOrArtist(user, pageable, artistId)
  }

  @Get("/byUploader/:uploaderId")
  public async findByUploader(@Param("uploaderId") uploaderId: string, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByUploaderId(uploaderId, pageable);
  }

  @Get("/byGenre/:genreId")
  public async findByGenre(@Param("genreId") genreId: string, @Pageable() pageable: Pageable, @AuthenticatedUser() user: User): Promise<Page<Song>> {
    return this.songService.findByGenreAndOrArtist(genreId, undefined, pageable, user)
  }

  @Get("/byGenre/:genreId/byArtist/:artistId")
  public async findByGenreAndArtist(@Param("genreId") genreId: string, @Param("artistId") artistId: string, @Pageable() pageable: Pageable, @AuthenticatedUser() user: User): Promise<Page<Song>> {
    return this.songService.findByGenreAndOrArtist(genreId, artistId, pageable, user)
  }

  @Get("/byArtist/:artistId/top")
  public async findTopSongsByArtist(@Param("artistId") artistId: string, @AuthenticatedUser() user: User): Promise<Page<Song>> {
    return this.songService.findTopSongsByArtist(artistId, user, { page: 0, size: 5 })
  }

  @Get("/byArtist/:artistId")
  public async findSongsByArtist(@Param("artistId") artistId: string, @AuthenticatedUser() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findSongsByArtist(artistId, pageable, user)
  }

  @Get("/byAlbum/:albumId")
  public async findByAlbum(@Param("albumId") albumId: string, @AuthenticatedUser() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByAlbum(albumId, pageable, user)
  }

  @Get("/byAlbum/:albumId/ids")
  public async findIdsByAlbum(@Param("albumId") albumId: string): Promise<Page<Song>> {
    return this.songService.findIdsByAlbum(albumId)
  }




  @Get("/byPlaylist/:playlistId")
  public async findPageByPlaylist(@Param("playlistId") playlistId: string, @AuthenticatedUser() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByPlaylist(playlistId, user, pageable)
  }

  @Get("/byPlaylist/:playlistId/ids")
  public async findIdsByPlaylist(@Param("playlistId") playlistId: string, @AuthenticatedUser() user: User): Promise<Page<Song>> {
    return this.songService.findIdsByPlaylist(playlistId, user)
  }







  @Get(":songId")
  public async findById(@Param("songId") songId: string, @AuthenticatedUser() user: User): Promise<Song> {
    return this.songService.findById(songId, user);
  }

}
