import { Controller, Get, Param } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { Authentication } from '../authentication/decorators/authentication.decorator';
import { User } from '../user/entities/user.entity';
import { Song } from './entities/song.entity';
import { SongService } from './song.service';

@Controller('songs')
export class SongController {
  constructor(private readonly songService: SongService) {}

  @Get("latest")
  public async findLatest(@Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findLatestPage(user);
  }

  @Get("oldest")
  public async findOldestRelease(@Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findOldestReleasePage(user);
  }

  @Get("/byCollection")
  public async findByCollection(@Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByCollectionAndOrArtist(user, pageable)
  }

  @Get("/byCollection/ids")
  public async findIdsByCollection(@Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findIdsByCollection(user)
  }

  @Get("/byCollection/byArtist/:artistId")
  public async findByCollectionAndArtist(@Param("artistId") artistId: string, @Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByCollectionAndOrArtist(user, pageable, artistId)
  }

  @Get("/byUploader/:uploaderId")
  public async findByUploader(@Param("uploaderId") uploaderId: string, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByUploaderId(uploaderId, pageable);
  }

  @Get("/byGenre/:genreId")
  public async findByGenre(@Param("genreId") genreId: string, @Pageable() pageable: Pageable, @Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findByGenreAndOrArtist(genreId, undefined, pageable, user)
  }

  @Get("/byGenre/:genreId/byArtist/:artistId")
  public async findByGenreAndArtist(@Param("genreId") genreId: string, @Param("artistId") artistId: string, @Pageable() pageable: Pageable, @Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findByGenreAndOrArtist(genreId, artistId, pageable, user)
  }




  @Get("/byArtist/:artistId/top")
  public async findTopSongsByArtist(@Param("artistId") artistId: string, @Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findTopSongsByArtist(artistId, user, { page: 0, size: 5 })
  }
  @Get("/byArtist/:artistId/top/ids")
  public async findTopSongIdsByArtist(@Param("artistId") artistId: string): Promise<Page<Song>> {
    return this.songService.findTopSongsIdsByArtist(artistId)
  }



  @Get("/byArtist/:artistId")
  public async findSongsByArtist(@Param("artistId") artistId: string, @Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findSongsByArtist(artistId, pageable, user)
  }
  @Get("/byArtist/:artistId/ids")
  public async findIdsByArtist(@Param("artistId") artistId: string): Promise<Page<Song>> {
    return this.songService.findIdsByArtist(artistId)
  }





  @Get("/byAlbum/:albumId")
  public async findByAlbum(@Param("albumId") albumId: string, @Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByAlbum(albumId, pageable, user)
  }
  @Get("/byAlbum/:albumId/ids")
  public async findIdsByAlbum(@Param("albumId") albumId: string): Promise<Page<Song>> {
    return this.songService.findIdsByAlbum(albumId)
  }




  @Get("/byPlaylist/:playlistId")
  public async findPageByPlaylist(@Param("playlistId") playlistId: string, @Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByPlaylist(playlistId, user, pageable)
  }
  @Get("/byPlaylist/:playlistId/ids")
  public async findIdsByPlaylist(@Param("playlistId") playlistId: string, @Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findIdsByPlaylist(playlistId, user)
  }







  @Get(":songId")
  public async findById(@Param("songId") songId: string, @Authentication() user: User): Promise<Song> {
    return this.songService.findById(songId, user);
  }

}
