import { Controller, Get, Param } from '@nestjs/common';
import { Authentication, CanAccess, IsAuthenticated } from '@tsalliance/sso-nest';
import { Page, Pageable } from 'nestjs-pager';
import { User } from '../user/entities/user.entity';
import { Song } from './entities/song.entity';
import { SongService } from './song.service';

@Controller('songs')
export class SongController {
  constructor(private readonly songService: SongService) {}

  @Get("latest")
  @IsAuthenticated()
  public async findLatest(@Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findLatestPage(user);
  }

  @Get("oldest")
  @IsAuthenticated()
  public async findOldestRelease(@Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findOldestReleasePage(user);
  }

  @Get("/byCollection")
  @IsAuthenticated()
  public async findByCollection(@Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByCollectionAndOrArtist(user, pageable)
  }

  @Get("/byCollection/ids")
  @IsAuthenticated()
  public async findIdsByCollection(@Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findIdsByCollection(user)
  }

  @Get("/byCollection/byArtist/:artistId")
  @IsAuthenticated()
  public async findByCollectionAndArtist(@Param("artistId") artistId: string, @Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByCollectionAndOrArtist(user, pageable, artistId)
  }

  @Get("/byUploader/:uploaderId")
  @CanAccess("songs.read")
  public async findByUploader(@Param("uploaderId") uploaderId: string, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByUploaderId(uploaderId, pageable);
  }

  @Get("/byGenre/:genreId")
  @IsAuthenticated()
  public async findByGenre(@Param("genreId") genreId: string, @Pageable() pageable: Pageable, @Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findByGenreAndOrArtist(genreId, undefined, pageable, user)
  }

  @Get("/byGenre/:genreId/byArtist/:artistId")
  @IsAuthenticated()
  public async findByGenreAndArtist(@Param("genreId") genreId: string, @Param("artistId") artistId: string, @Pageable() pageable: Pageable, @Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findByGenreAndOrArtist(genreId, artistId, pageable, user)
  }

  @Get("/byArtist/:artistId/top")
  @IsAuthenticated()
  public async findTopSongsByArtist(@Param("artistId") artistId: string, @Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findTopSongsByArtist(artistId, user, { page: 0, size: 5 })
  }

  @Get("/byArtist/:artistId")
  @IsAuthenticated()
  public async findSongsByArtist(@Param("artistId") artistId: string, @Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findSongsByArtist(artistId, pageable, user)
  }

  @Get("/byAlbum/:albumId")
  @IsAuthenticated()
  public async findByAlbum(@Param("albumId") albumId: string, @Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByAlbum(albumId, pageable, user)
  }

  @Get("/byPlaylist/:playlistId")
  @IsAuthenticated()
  public async findPageByPlaylist(@Param("playlistId") playlistId: string, @Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByPlaylist(playlistId, user, pageable)
  }

  @Get("/byPlaylist/:playlistId/ids")
  @IsAuthenticated()
  public async findIdsByPlaylist(@Param("playlistId") playlistId: string, @Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findIdsByPlaylist(playlistId, user)
  }

  @Get(":songId")
  @IsAuthenticated()
  public async findById(@Param("songId") songId: string, @Authentication() user: User): Promise<Song> {
    return this.songService.findById(songId, user);
  }

}
